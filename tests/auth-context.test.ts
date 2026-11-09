import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath } from "../src/lib/passport";
import {
  authHref,
  navigationAuthContext,
  signedInDestination,
  confirmationCallbackUrl,
} from "../src/lib/auth-navigation";
import {
  passwordSignIn,
  passwordSignUp,
  resendSignupConfirmation,
  emailConfirmationDestination,
} from "../src/lib/auth-flow";
import { projectApplicationState } from "../src/lib/project-application";

const challenge = "/challenges/00000000-0000-4000-8000-000000000001#submit";
const project = "/paid-projects/00000000-0000-4000-8000-000000000002";
const user = { user_metadata: { preferred_role: "talent" } };
const success = {
  data: { user, session: { access_token: "offline-fixture-not-a-token" } },
  error: null,
};
const fail = {
  data: { user: null, session: null },
  error: { message: "private-provider-detail" },
};
function form(next: string = project) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    next,
    email: "fixture@example.invalid",
    password: "offline-password-only",
    full_name: "Offline fixture",
    role: "talent",
  }))
    f.set(k, v);
  return f;
}
const url = (path: string) => new URL(path, "https://proofpak.invalid");
const signupDeps = () => ({
  configured: true,
  siteUrl: "https://proofpak.invalid",
  profileReady: async () => true,
  signUp: async () => success,
});

test("return paths accept only canonical challenge/project UUID destinations and supported anchors", () => {
  for (const path of [challenge, challenge.split("#")[0], project])
    assert.equal(safeReturnPath(path), path);
  for (const path of [
    undefined,
    null,
    [project],
    "",
    "https://evil.example",
    "//evil.example",
    `https://proofpak.invalid${project}`,
    "/sign-in",
    "/auth/callback",
    "/portal/talent",
    `${project}?next=https://evil.example`,
    `${project}#pay`,
    `${challenge}#other`,
    `${project}\n`,
    `${project}\u2028`,
    ` ${project}`,
    `/paid-projects/../../sign-in`,
    project.replace("/paid", "\\paid"),
    encodeURIComponent(project),
    `${project}%0d%0aLocation:evil`,
    "/challenges/------------------------------------",
  ])
    assert.equal(safeReturnPath(path), null, String(path));
});
test("login/signup switching revalidates context on every hop and never embeds private form fields", () => {
  for (const next of [challenge, project]) {
    const signup = authHref("/sign-up", next);
    assert.equal(url(signup).searchParams.get("next"), next);
    assert.equal(
      url(
        authHref("/sign-in", url(signup).searchParams.get("next")),
      ).searchParams.get("next"),
      next,
    );
    assert.deepEqual([...url(signup).searchParams.keys()], ["next"]);
  }
  assert.equal(authHref("/sign-in", "//evil.example"), "/sign-in");
  assert.equal(authHref("/sign-up", null, "company"), "/sign-up?role=company");
});
test("successful existing-user login returns to either opportunity; defaults and current-user destinations cannot loop", async () => {
  for (const next of [challenge, project])
    assert.equal(
      await passwordSignIn(form(next), {
        configured: true,
        signIn: async () => success,
      }),
      next,
    );
  for (const next of ["", "/sign-in", "//evil.example"]) {
    assert.equal(
      await passwordSignIn(form(next), {
        configured: true,
        signIn: async () => success,
      }),
      "/portal/talent",
    );
    assert.equal(
      signedInDestination(
        { user_metadata: { preferred_role: "company" } },
        next,
      ),
      "/portal/company",
    );
  }
  assert.equal(signedInDestination(user, project), project);
});
test("failed login, malformed input, network failure and missing session all keep safe retry context", async () => {
  for (const next of [challenge, project]) {
    const providers = [
      async () => fail,
      async () => {
        throw new Error("private transport detail");
      },
      async () => ({ ...success, data: { user, session: null } }),
    ];
    for (const signIn of providers) {
      const result = await passwordSignIn(form(next), {
        configured: true,
        signIn,
      });
      assert.equal(url(result).pathname, "/sign-in");
      assert.equal(url(result).searchParams.get("next"), next);
      assert.ok(!result.includes("private"));
    }
    const invalid = form(next);
    invalid.set("email", "not an email");
    const result = await passwordSignIn(invalid, {
      configured: true,
      signIn: async () => {
        throw new Error("must not run");
      },
    });
    assert.equal(url(result).searchParams.get("next"), next);
  }
});
test("unconfigured auth preserves next without calling a hosted service", async () => {
  const result = await passwordSignIn(form(), {
    configured: false,
    signIn: async () => {
      assert.fail("no network");
    },
  });
  assert.equal(url(result).searchParams.get("next"), project);
  const signup = await passwordSignUp(form(), {
    ...signupDeps(),
    configured: false,
    signUp: async () => {
      assert.fail("no network");
    },
  });
  assert.equal(url(signup).searchParams.get("next"), project);
});
test("signup confirmation URL and subsequent login retain the same opportunity without requiring public user metadata", async () => {
  for (const next of [challenge, project]) {
    let redirectTo = "";
    const result = await passwordSignUp(form(next), {
      ...signupDeps(),
      signUp: async (values) => {
        redirectTo = values.options.emailRedirectTo;
        assert.deepEqual(values.options.data, {
          full_name: "Offline fixture",
          preferred_role: "talent",
        });
        return { data: { user, session: null }, error: null };
      },
    });
    assert.equal(url(result).pathname, "/sign-in");
    assert.equal(url(result).searchParams.get("next"), next);
    const callback = new URL(redirectTo);
    assert.equal(callback.pathname, "/auth/callback");
    assert.equal(callback.searchParams.get("next"), next);
    callback.searchParams.set("code", "offline-code");
    assert.equal(
      await emailConfirmationDestination(callback.searchParams, {
        configured: true,
        exchange: async (code) => {
          assert.equal(code, "offline-code");
          return success;
        },
      }),
      next,
    );
  }
});
test("immediate signup session uses opportunity and normal signup defaults still work", async () => {
  assert.equal(await passwordSignUp(form(), signupDeps()), project);
  assert.equal(await passwordSignUp(form(""), signupDeps()), "/portal/talent");
});
test("signup schema/provider/validation failures retain destination and starting role", async () => {
  const f = form();
  f.set("role", "company");
  for (const deps of [
    { ...signupDeps(), profileReady: async () => false },
    { ...signupDeps(), signUp: async () => fail },
  ]) {
    const result = url(await passwordSignUp(f, deps));
    assert.equal(result.pathname, "/sign-up");
    assert.equal(result.searchParams.get("next"), project);
    assert.equal(result.searchParams.get("role"), "company");
  }
  f.set("password", "short");
  assert.equal(
    url(await passwordSignUp(f, signupDeps())).searchParams.get("next"),
    project,
  );
});
test("resend confirmation retains destination in callback, validation and provider errors", async () => {
  for (const error of [null, { message: "private-error" }]) {
    const result = await resendSignupConfirmation(form(), {
      configured: true,
      siteUrl: "https://proofpak.invalid",
      resend: async (values) => {
        assert.equal(
          new URL(values.options.emailRedirectTo).searchParams.get("next"),
          project,
        );
        return { error };
      },
    });
    assert.equal(url(result).searchParams.get("next"), project);
    assert.ok(!result.includes("private-error"));
  }
});
test("email failure, missing/used codes and incomplete sessions preserve a safe login retry", async () => {
  for (const exchange of [
    async () => fail,
    async () => {
      throw new Error("private-code-error");
    },
    async () => ({ ...success, data: { user, session: null } }),
  ]) {
    const result = await emailConfirmationDestination(
      new URLSearchParams({ code: "fixture", next: project }),
      { configured: true, exchange },
    );
    assert.equal(url(result).pathname, "/sign-in");
    assert.equal(url(result).searchParams.get("next"), project);
    assert.ok(!result.includes("fixture"));
  }
  const missing = await emailConfirmationDestination(
    new URLSearchParams({ next: challenge }),
    {
      configured: true,
      exchange: async () => {
        assert.fail("missing code");
      },
    },
  );
  assert.equal(url(missing).searchParams.get("next"), challenge);
});
test("password recovery takes priority and unsafe callback targets fall back to workspace", async () => {
  assert.equal(
    await emailConfirmationDestination(
      new URLSearchParams({
        code: "fixture",
        purpose: "recovery",
        next: project,
      }),
      { configured: true, exchange: async () => success },
    ),
    "/reset-password",
  );
  assert.equal(
    await emailConfirmationDestination(
      new URLSearchParams({ code: "fixture", next: "//evil.example" }),
      { configured: true, exchange: async () => success },
    ),
    "/portal/talent",
  );
  assert.equal(
    new URL(
      confirmationCallbackUrl(
        "https://proofpak.invalid",
        "https://evil.example",
      ),
    ).searchParams.has("next"),
    false,
  );
});
test("returning never grants eligibility or automatically applies to expired/closed work", () => {
  for (const status of ["published", "withdrawn", "completed", "cancelled"]) {
    assert.equal(
      projectApplicationState(
        {
          signedIn: true,
          companyMember: false,
          hasApplication: false,
          status,
          deadline: "2020-01-01",
        },
        "2026-11-10",
      ),
      "closed",
    );
  }
  // The auth destination remains a GET route, with no action query or payment endpoint.
  assert.equal(signedInDestination(user, project), project);
});

test("global Auth navigation preserves opportunity/Auth context without leaking it to unrelated pages", () => {
  assert.equal(navigationAuthContext(project, null), project);
  assert.equal(
    navigationAuthContext(challenge.split("#")[0], null),
    challenge.split("#")[0],
  );
  for (const page of ["/sign-in", "/sign-up", "/resend-confirmation"])
    assert.equal(navigationAuthContext(page, project), project);
  for (const page of ["/", "/opportunities", "/wallet", null])
    assert.equal(navigationAuthContext(page, project), null);
  assert.equal(navigationAuthContext("/sign-in", "//evil.example"), null);
});
