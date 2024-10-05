/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import * as cheerio from 'cheerio';
import axios from 'axios';

import * as logger from 'firebase-functions/logger';

// import { Timestamp, serverTimestamp } from 'firebase/firestore';
import * as firebase from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
firebase.initializeApp();
const firestore = firebase.firestore();

export const getScryfallTags = onSchedule('0 0 1 * *', async () => {
    const otags: string[] = [];
    const atags: string[] = [];
    try {
        const resp = await axios.get('https://scryfall.com/docs/tagger-tags');
        const $ = cheerio.load(resp.data);
        $('.prose > h2').each((_, element) => {
            const header = $(element);
            const tags: string[] = [];
            header
                .next('p')
                .children('a')
                .each((_, element) => {
                    const tag = $(element).text();
                    tags.push(tag);
                });
            if (header.text().endsWith('(functional)')) {
                otags.push(...tags);
            } else {
                atags.push(...tags);
            }
        });
    } catch (e: any) {
        logger.error(e);
        return;
    }
    if (otags.length === 0 || atags.length === 0) return;
    try {
        const tagsRef = firestore.doc('cards/tags');
        const timeStamp = Timestamp.fromDate(new Date());
        tagsRef.update({
            otags: otags,
            atags: atags,
            updatedAt: timeStamp,
        });
        const backupsRef = firestore.collection('cards/tags/backups');
        backupsRef.add({
            otags: otags,
            atags: atags,
            createdAt: timeStamp,
        });
        logger.log('succesfully updated tags.');
    } catch (e: any) {
        logger.error(e);
    }
});
