import { onSchedule } from 'firebase-functions/v2/scheduler';
import { parse } from 'node-html-parser';
import axios from 'axios';
import * as logger from 'firebase-functions/logger';
import * as firebase from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

firebase.initializeApp();
const firestore = firebase.firestore();

export const getScryfallTags = onSchedule('0 0 1 * *', async () => {
    const otags: string[] = [];
    const atags: string[] = [];

    try {
        const resp = await axios.get('https://scryfall.com/docs/tagger-tags');
        const root = parse(resp.data);

        const headers = root.querySelectorAll('.prose > h2');

        headers.forEach((header) => {
            if (!header.textContent) return;
            const tags: string[] = [];
            const nextParagraph = header.nextElementSibling;

            if (nextParagraph) {
                const links = nextParagraph.querySelectorAll('a');
                links.forEach((link) => {
                    if (!link.textContent) return;
                    const tag = link.textContent.trim();
                    tags.push(tag);
                });

                if (header.textContent.endsWith('(functional)')) {
                    otags.push(...tags);
                } else {
                    atags.push(...tags);
                }
            }
        });
    } catch (e: unknown) {
        logger.error('Error fetching Scryfall tags', e);
        return;
    }

    if (otags.length === 0 || atags.length === 0) return;

    try {
        const tagsRef = firestore.doc('cards/tags');
        const timeStamp = Timestamp.fromDate(new Date());

        await tagsRef.update({
            otags,
            atags,
            updatedAt: timeStamp,
        });

        const backupsRef = firestore.collection('cards/tags/backups');
        await backupsRef.add({
            otags,
            atags,
            createdAt: timeStamp,
        });

        logger.log('Successfully updated tags.');
    } catch (e: unknown) {
        logger.error('Error updating Firestore', e);
    }
});
