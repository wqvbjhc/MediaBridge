#!/usr/bin/env bash
set -e

mkdir -p /app/cookies

if [ -n "${COOKIES_TXT_B64}" ]; then
    echo "${COOKIES_TXT_B64}" | base64 -d > /app/cookies/cookies.txt
    echo "[start] cookies.txt restored from COOKIES_TXT_B64 ($(wc -c < /app/cookies/cookies.txt) bytes)"
elif [ -n "${COOKIES_TXT}" ]; then
    printf '%s' "${COOKIES_TXT}" > /app/cookies/cookies.txt
    echo "[start] cookies.txt restored from COOKIES_TXT (plain, $(wc -c < /app/cookies/cookies.txt) bytes)"
else
    echo "[start] no COOKIES_TXT(_B64) env, running without cookies"
fi

exec node server.js
