process.env.EXPO_PUBLIC_API_URL = 'https://api.test.local';

jest.mock('expo-file-system/legacy', () => ({
    cacheDirectory: '/mock-cache/',
    getInfoAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
}));

// Use require() inside each test (after jest.resetModules) — dynamic import() requires
// --experimental-vm-modules which jest-expo does not enable.

beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
});

describe('getTaxonomy', () => {
    it('returns fallback when cache is empty and no network', async () => {
        const FileSystem = require('expo-file-system/legacy');
        FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
        FileSystem.writeAsStringAsync.mockResolvedValue(undefined);
        global.fetch = jest.fn().mockRejectedValue(new Error('No network'));

        const { TAXONOMY_FALLBACK } = require('../taxonomy-fallback');
        const { loadTaxonomy, getTaxonomy } = require('../taxonomy');
        await loadTaxonomy();
        const tax = getTaxonomy();
        expect(tax.categories).toEqual(TAXONOMY_FALLBACK.categories);
        expect(tax.subcategoriesByCategory['Food'].length).toBeGreaterThan(0);
    });

    it('stores fetched data in memory cache', async () => {
        const FileSystem = require('expo-file-system/legacy');
        FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
        FileSystem.writeAsStringAsync.mockResolvedValue(undefined);

        const mockData = {
            categories: ['Food'],
            subcategoriesByCategory: { Food: ['ramen', 'new-sub'] },
            labels: { en: { 'Food.ramen': 'Ramen', 'Food.new-sub': 'New Sub' }, es: {} },
        };
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => '"etag-123"' },
            json: async () => mockData,
        } as unknown as Response);

        const { loadTaxonomy, getTaxonomy } = require('../taxonomy');
        await loadTaxonomy();
        const tax = getTaxonomy();
        expect(tax.subcategoriesByCategory['Food']).toContain('new-sub');
        expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    });

    it('uses file cache when fresh', async () => {
        const FileSystem = require('expo-file-system/legacy');
        const cachedData = {
            categories: ['Food'],
            subcategoriesByCategory: { Food: ['cached-sub'] },
            labels: { en: { 'Food.cached-sub': 'Cached Sub' }, es: {} },
        };
        FileSystem.getInfoAsync.mockResolvedValue({
            exists: true,
            modificationTime: Date.now() / 1000 - 100, // 100s ago, within 24h TTL
        });
        FileSystem.readAsStringAsync.mockResolvedValue(
            JSON.stringify({ data: cachedData }),
        );
        FileSystem.writeAsStringAsync.mockResolvedValue(undefined);

        const networkFetch = jest.fn();
        global.fetch = networkFetch;

        const { loadTaxonomy, getTaxonomy } = require('../taxonomy');
        await loadTaxonomy();
        expect(networkFetch).not.toHaveBeenCalled();
        expect(getTaxonomy().subcategoriesByCategory['Food']).toContain('cached-sub');
    });
});
