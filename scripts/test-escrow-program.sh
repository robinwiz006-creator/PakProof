#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cargo_cache="${PROOFPAK_ESCROW_CARGO_CACHE:-proofpak-escrow-cargo}"
args=(--rm --cpus=2 -v "$PWD/programs/proofpak-escrow:/code" -v "$cargo_cache:/usr/local/cargo" -w /code -e HTTP_PROXY -e HTTPS_PROXY -e ALL_PROXY -e SOLANA_RAYON_THREADS=2 -e RAYON_NUM_THREADS=2)
ca_path="${SSL_CERT_FILE:-/etc/ssl/certs/ca-certificates.crt}"
if [[ -f "$ca_path" ]]; then args+=(-v "$ca_path:/trusted-ca.crt:ro" -e CARGO_HTTP_CAINFO=/trusted-ca.crt); fi
docker run "${args[@]}" rust:1.89-bookworm@sha256:948f9b08a66e7fe01b03a98ef1c7568292e07ec2e4fe90d88c07bb14563c84ff cargo test --locked --test custody -- --test-threads=1
