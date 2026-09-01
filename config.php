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
const STATUS_SITE_URL = 'https://thesecretary-status.gt.tc/';

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
const GOOGLE_APPS_SCRIPT_SECRET = '6e61dcbb356f951215018fec3c8e9a8c5fd59ad9b426fcb8f2378669accc778e';

const APP_TIMEZONE = 'Asia/Kolkata';
const SESSION_NAME = 'secretary_status_session';
const REMEMBER_COOKIE_NAME = 'secretary_remember';
const REMEMBER_COOKIE_DAYS = 30;
const API_TIMEOUT_SECONDS = 45;
