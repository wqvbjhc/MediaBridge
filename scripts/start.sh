#!/usr/bin/env bash
set -e

# WORKDIR 现在是 /home/user/app（HF 文档推荐路径）；cookies 落在 ./cookies/
mkdir -p ./cookies

if [ -n "${COOKIES_TXT_B64}" ]; then
    echo "${COOKIES_TXT_B64}" | base64 -d > ./cookies/cookies.txt
    echo "[start] cookies.txt restored from COOKIES_TXT_B64 ($(wc -c < ./cookies/cookies.txt) bytes)"
elif [ -n "${COOKIES_TXT}" ]; then
    printf '%s' "${COOKIES_TXT}" > ./cookies/cookies.txt
    echo "[start] cookies.txt restored from COOKIES_TXT (plain, $(wc -c < ./cookies/cookies.txt) bytes)"
else
    echo "[start] no COOKIES_TXT(_B64) env, running without cookies"
fi

exec node server.js
