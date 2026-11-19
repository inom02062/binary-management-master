
import { Block, Apartment, ApartmentStatus } from '../types';
import { tenantStorageKey } from './tenantStorage';

// Initial data keys
const DB_KEY_BLOCKS = () => tenantStorageKey('blm_blocks');
const DB_KEY_APTS = () => tenantStorageKey('blm_apts');

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

export const db = {
  getBlocks: (): Block[] => {
    const data = localStorage.getItem(DB_KEY_BLOCKS());
    return data ? JSON.parse(data) : [];
  },

  saveBlock: (block: Block) => {
    const blocks = db.getBlocks();
    const existingIndex = blocks.findIndex(b => b.id === block.id);
    if (existingIndex >= 0) {
      blocks[existingIndex] = block;
    } else {
      blocks.push(block);
      // Initialize apartments for new block
      db.initApartmentsForBlock(block);
    }
    localStorage.setItem(DB_KEY_BLOCKS(), JSON.stringify(blocks));
  },

  deleteBlock: (blockId: string) => {
    let blocks = db.getBlocks();
    blocks = blocks.filter(b => b.id !== blockId);
    localStorage.setItem(DB_KEY_BLOCKS(), JSON.stringify(blocks));
    
    // Cleanup apartments
    let apts = db.getApartments();
    apts = apts.filter(a => a.blockId !== blockId);
    localStorage.setItem(DB_KEY_APTS(), JSON.stringify(apts));
  },

  getApartments: (): Apartment[] => {
    const data = localStorage.getItem(DB_KEY_APTS());
    return data ? JSON.parse(data) : [];
  },

  getApartmentsByBlock: (blockId: string): Apartment[] => {
    return db.getApartments().filter(a => a.blockId === blockId);
  },

  saveApartment: (apt: Apartment) => {
    const apts = db.getApartments();
    const index = apts.findIndex(a => a.id === apt.id);
    if (index >= 0) {
      apts[index] = apt;
    } else {
      apts.push(apt);
    }
    localStorage.setItem(DB_KEY_APTS(), JSON.stringify(apts));
  },

  initApartmentsForBlock: (block: Block) => {
    const apts = db.getApartments();
    let currentAptNum = 1;
    for (let f = 1; f <= block.floorsCount; f++) {
      for (let a = 1; a <= block.aptsPerFloor; a++) {
        apts.push({
          id: generateId(),
          blockId: block.id,
          floor: f,
          number: currentAptNum++,
          status: ApartmentStatus.EMPTY,
          payments: []
        });
      }
    }
    localStorage.setItem(DB_KEY_APTS(), JSON.stringify(apts));
  },

  // --- Data Management Functions (Simulating DB Dump) ---

  exportDatabase: (): string => {
    const data = {
      blocks: db.getBlocks(),
      apartments: db.getApartments(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  },

  importDatabase: (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.blocks) && Array.isArray(data.apartments)) {
        localStorage.setItem(DB_KEY_BLOCKS(), JSON.stringify(data.blocks));
        localStorage.setItem(DB_KEY_APTS(), JSON.stringify(data.apartments));
        return true;
      }
      return false;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  }
};
