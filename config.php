<?php
declare(strict_types=1);

/*
 * The Secretary Status configuration
 * 1. Deploy the private monitor endpoint first.
 * 2. Paste its endpoint URL and the same long API secret below.
 */

const APP_NAME = 'The Secretary Status';
const ADMIN_EMAIL = 'dikshitaggarwal007@gmail.com';
const MAIN_SITE_URL = 'https://thesecretary.xyz/';
const STATUS_SITE_URL = 'https://the-secretary-status.github.io/';

/*
 * Community database (InfinityFree MySQL).
 * Copy the exact values from InfinityFree's MySQL Databases panel.
 * Do not use "localhost" unless the panel explicitly tells you to.
 */
const DB_HOST = 'PASTE_INFINITYFREE_MYSQL_HOST';
const DB_NAME = 'PASTE_INFINITYFREE_DATABASE_NAME';
const DB_USER = 'PASTE_INFINITYFREE_DATABASE_USER';
const DB_PASSWORD = 'PASTE_INFINITYFREE_DATABASE_PASSWORD';
const DB_CHARSET = 'utf8mb4';

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXryWaU-Chu_Z_lRfslI7w9Stz043rVs0IoqRD4HAuhx2AWHstHf6CIqWLCpS_AUN3CQ/exec';
// Retired in 4.0. GitHub Pages must never contain a private API secret.
const GOOGLE_APPS_SCRIPT_SECRET = 'RETIRED_ROTATE_THE_APPS_SCRIPT_API_SECRET';

const APP_TIMEZONE = 'Asia/Kolkata';
const SESSION_NAME = 'secretary_status_session';
const REMEMBER_COOKIE_NAME = 'secretary_remember';
const REMEMBER_COOKIE_DAYS = 30;
const API_TIMEOUT_SECONDS = 45;
