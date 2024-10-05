import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { IScryfallCatalog } from '../../types/interfaces/scryfall/catalog';
import { catalogToFastAutocomplete } from '../../types/reducers/catalog';
import { IScryfallSetResult } from '../../types/interfaces/scryfall/set';
import { ScryfallCatalog } from '@scryfall/api-types';

async function getScryfallCatalog(): Promise<IScryfallCatalog> {
    const promises = [];
    const catalog: IScryfallCatalog = {
        'artist-names': [],
        'creature-types': [],
        'planeswalker-types': [],
        'land-types': [],
        'artifact-types': [],
        'enchantment-types': [],
        'spell-types': [],
        powers: [],
        toughnesses: [],
        loyalties: [],
        watermarks: [],
        'keyword-abilities': [],
        'keyword-actions': [],
        'ability-words': [],
        supertypes: [],
        'word-bank': [],
        'card-types': [
            // Standard Types
            'Artifact',
            'Battle',
            'Creature',
            'Enchantment',
            'Instant',
            'Land',
            'Planeswalker',
            'Sorcery',
            // Older and Casual Types
            'Conspiracy',
            'Hero',
            'Host',
            'Plane',
            'Phenomenon',
            'Scheme',
            'Vanguard',
            // Silver-Border Sets (e.g., Unglued, Unhinged)
            'Ad',
            'Joke',
            'Nonsense',
            'Word',
        ],
        criteria: [
            'Adveanture',
            'Arena ID',
            'Art Series',
            'Artist',
            'Artist Misprint',
            'Attraction Lights',
            'Augment',
            'Back',
            'Bear',
            'Booster',
            'Borderless',
            'Brawl Commander',
            'Buy-a-Box',
            'Cardmarket ID',
            'Class Layout',
            'Color Indicator',
            'Colorshifted',
            'Commander',
            'Companion',
            'Content Warning',
            'Covered',
            'Creature Land',
            'Datestamped',
            'Digital',
            'Double Sided',
            'Duel Commander',
            'E T B',
            'English Art',
            'Etched',
            'Extended Art',
            'Extra',
            'First Printing',
            'Flavor Name',
            'Flavor Text',
            'Flip',
            'Foil',
            'Foreign Black Border',
            'Foreign White Border',
            'French Vanilla',
            'Full Art',
            'Funny',
            'Future',
            'Game Day',
            'Highres',
            'Historic',
            'Hybrid Mana',
            'Illustration',
            'Intro Pack',
            'Invitational Card',
            'Leveler',
            'Localized Name',
            'MTGO ID',
            'Masterpiece',
            'Meld',
            'Modal',
            'Modal Double Faced',
            'Modern',
            'Multiverse ID',
            'New',
            'Nonfoil',
            'Oathbreaker',
            'Old',
            'Oversized',
            'Paired Commander',
            'Paper Art',
            'Party',
            'Permanent',
            'Phyrexian Mana',
            'Planar',
            'Planeswalker Deck',
            'Prerelease Promo',
            'Printed Text',
            'Promo',
            'Related',
            'Release Promo',
            'Reprint',
            'Reserved List',
            'Reversible',
            'Security Stamp',
            'Showcase',
            'Spell',
            'Spellbook',
            'Spikey',
            'Split Card',
            'Stamped',
            'Starter Deck',
            'Story Spotlight',
            'TCGplayer ID',
            'Textless',
            'Token',
            'Tombstone',
        ],
        'mana-costs': ['{W}', '{U}', '{B}', '{R}', '{G}'],
        sets: [],
    };
    for (const category in catalog) {
        if (category == 'sets' || catalog[category].length > 0) continue;
        const promise = axios
            .get<ScryfallCatalog>(`https://api.scryfall.com/catalog/${category}`)
            .then((response) => {
                catalog[category] = response.data.data;
            });
        promises.push(promise);
    }
    promises.push(
        axios.get<IScryfallSetResult>(`https://api.scryfall.com/sets`).then((response) => {
            catalog['sets'] = response.data.data.map((set) => set.code);
        }),
    );
    await Promise.all(promises);
    return catalog;
}

function useScryfallCatalog() {
    const catalogQuery = useQuery({
        queryKey: ['scryfallCatalog'],
        queryFn: () => getScryfallCatalog().then((catalog) => catalog),
    });

    return catalogQuery;
}

function useScryfallFilterMap() {
    const filterMapQuery = useQuery({
        queryKey: ['scryfallCatalog'],
        queryFn: () => getScryfallCatalog().then((catalog) => catalogToFastAutocomplete(catalog)),
    });

    return filterMapQuery;
}

export { useScryfallCatalog, useScryfallFilterMap };
