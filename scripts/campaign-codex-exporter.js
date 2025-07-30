// Redesigned & Refactored Campaign Codex Exporter
export class SimpleCampaignCodexExporter {
  static CONSTANTS = {
    FLAG_SCOPE: "campaign-codex",
    FLAG_TYPE: "type",
    FLAG_DATA: "data",
    FLAG_IS_MASTER: "isMasterReference",
    FLAG_MASTER_DATA: "masterData",
    MASTER_REF_NAME: "📋 Campaign Codex Master Reference",
  };

  // ===========================================
  // PRIMARY PUBLIC METHODS
  // ===========================================

  static async exportCampaignCodexToCompendium() {
    try {
      const config = await this._getExportConfig();
      if (!config) return;

      const compendiums = await this._createCompendiumSet(config.baseName);
      if (!compendiums) return;

      const exportData = this._collectExportData();
      if (exportData.journals.length === 0) {
        ui.notifications.warn("No Campaign Codex documents found to export!");
        return;
      }

      const confirmed = await this._confirmExport(exportData, config.baseName);
      if (!confirmed) return;

      ui.notifications.info(`Exporting ${exportData.journals.length} journals, ${exportData.actors.length} actors, and ${exportData.items.length} items...`);

      const uuidMap = await this._performExport(exportData, compendiums);

      await this._createMasterReference(exportData, compendiums, uuidMap, config);

      ui.notifications.info(`Export complete! Compendium set "${config.baseName}" is ready for sharing.`);
    } catch (error) {
      console.error("Campaign Codex Export Error:", error);
      ui.notifications.error(`Export failed: ${error.message}`);
    }
  }

  static async importCampaignCodexFromCompendium() {
    try {
      const compendiumSet = await this._selectCompendiumSet();
      if (!compendiumSet) return;

      const strategy = await this._getImportStrategy();
      if (!strategy) return;

      const masterRef = await this._loadMasterReference(compendiumSet.journals);
      if (!masterRef) {
        ui.notifications.error("No valid Campaign Codex export found in selected compendium!");
        return;
      }

      const results = await this._performImport(compendiumSet, masterRef, strategy);
      this._reportImportResults(results);

      if (game.settings.get(this.CONSTANTS.FLAG_SCOPE, "useOrganizedFolders")) {
        await this._organizeImportedDocuments();
      }
    } catch (error) {
      console.error("Campaign Codex Import Error:", error);
      ui.notifications.error(`Import failed: ${error.message}`);
    }
  }

  // ===========================================
  // DATA COLLECTION
  // ===========================================

  static _collectExportData() {
    const { FLAG_SCOPE, FLAG_TYPE, FLAG_DATA } = this.CONSTANTS;
    const journals = [];
    const actorIds = new Set();
    const itemIds = new Set();

    for (const journal of game.journal) {
      if (!journal.getFlag(FLAG_SCOPE, FLAG_TYPE)) continue;
      journals.push(journal);
      const data = journal.getFlag(FLAG_SCOPE, FLAG_DATA) || {};

      if (data.linkedActor) actorIds.add(data.linkedActor);
      if (data.inventory?.length) {
        data.inventory.forEach(item => item.itemId && itemIds.add(item.itemId));
      }
    }

    const actors = Array.from(actorIds).map(id => game.actors.get(id)).filter(Boolean);
    const items = Array.from(itemIds).map(id => game.items.get(id)).filter(Boolean);

    return { journals, actors, items };
  }


  // ===========================================
  // EXPORT PROCESS
  // ===========================================

  static async _performExport(exportData, compendiums) {
    const uuidMap = { actors: new Map(), items: new Map(), journals: new Map() };

    // Step 1 & 2: Export Actors and Items, creating UUID maps
    for (const actor of exportData.actors) {
      const exported = await this._exportDocument(actor, compendiums.actors);
      uuidMap.actors.set(actor.id, exported.uuid);
    }
    for (const item of exportData.items) {
      const exported = await this._exportDocument(item, compendiums.items);
      uuidMap.items.set(item.id, exported.uuid);
    }

    // Step 3: Export journals with placeholder data to establish UUIDs
    for (const journal of exportData.journals) {
      const exported = await this._exportDocument(journal, compendiums.journals, { placeholder: true });
      uuidMap.journals.set(journal.id, exported.uuid);
    }

    // Step 4: Update journals in the compendium with the now-complete UUID maps
    await this._updateJournalReferences(exportData.journals, compendiums.journals, uuidMap);

    return uuidMap;
  }

  static async _exportDocument(document, targetPack, { placeholder = false } = {}) {
    const { FLAG_SCOPE, FLAG_DATA } = this.CONSTANTS;
    const exportData = document.toObject();

    // Use existing ID to allow for overwriting updates
    exportData._id = document.id;

    foundry.utils.setProperty(exportData, `flags.${FLAG_SCOPE}.originalId`, document.id);
    foundry.utils.setProperty(exportData, `flags.${FLAG_SCOPE}.exportedAt`, Date.now());
    
    // For journals, use placeholder data initially to break dependency cycles
    if (placeholder) {
      foundry.utils.setProperty(exportData, `flags.${FLAG_SCOPE}.${FLAG_DATA}`, {});
    }

    const existing = await targetPack.getDocument(document.id);
    if (existing) {
      await existing.update(exportData);
      return existing;
    }
    return await targetPack.importDocument(document);
  }

  static async _updateJournalReferences(journals, journalPack, uuidMap) {
    const { FLAG_SCOPE, FLAG_DATA } = this.CONSTANTS;
    const updates = [];
    const sourcePack = journalPack.collection; // e.g., "world.my-campaign-cc-journals"

    for (const journal of journals) {
      // 1. Convert the structured data in flags
      const originalFlagData = journal.getFlag(FLAG_SCOPE, FLAG_DATA) || {};
      const convertedFlagData = this._convertReferencesToUUIDs(originalFlagData, uuidMap);

      // 2. Convert the visible @UUID links in the journal's page content
      const originalPages = journal.toObject().pages;
      const convertedPages = this._convertJournalPages(originalPages, uuidMap);

      updates.push({
        _id: journal.id,
        // The pages and flag data are now correctly converted to compendium UUIDs
        pages: convertedPages,
        [`flags.${FLAG_SCOPE}.${FLAG_DATA}`]: convertedFlagData,
        // THIS IS THE NEW LINE: Make the document self-aware of its home
        [`flags.${FLAG_SCOPE}.sourcePack`]: sourcePack
      });
    }

    if (updates.length > 0) {
      // The rest of this function (the try/catch block for updateDocuments) remains the same...
      await JournalEntry.updateDocuments(updates, { pack: journalPack.collection, diff: false, recursive: false });
    }
  }

  static _convertReferencesToUUIDs(data, uuidMap) {
    const converted = foundry.utils.deepClone(data);
    const getUuid = (id, type) => uuidMap[type]?.get(id) || null;

    // Convert single references
    if (converted.linkedActor) converted.linkedActor = getUuid(converted.linkedActor, 'actors');
    if (converted.linkedLocation) converted.linkedLocation = getUuid(converted.linkedLocation, 'journals');
    
    // Convert array references
    const journalArrayFields = ['linkedNPCs', 'linkedShops', 'linkedLocations', 'associates'];
    journalArrayFields.forEach(field => {
      if (Array.isArray(converted[field])) {
        converted[field] = converted[field].map(id => getUuid(id, 'journals')).filter(Boolean);
      }
    });

    // Convert inventory
    if (Array.isArray(converted.inventory)) {
      converted.inventory = converted.inventory.map(item => {
        const uuid = getUuid(item.itemId, 'items');
        if (uuid) item.itemId = uuid;
        return item;
      }).filter(item => item.itemId);
    }
    
    return converted;
  }
  
  // ===========================================
  // IMPORT PROCESS
  // ===========================================
  
  static async _performImport(compendiumSet, masterRef, strategy) {
    const results = { actors: { imported: 0, skipped: 0, errors: 0 }, items: { imported: 0, skipped: 0, errors: 0 }, journals: { imported: 0, skipped: 0, errors: 0 } };
    const worldIdMap = { actors: new Map(), items: new Map(), journals: new Map() };

    // Import documents, populating the worldIdMap
    for (const type of ["actors", "items", "journals"]) {
        for (const ref of masterRef[type]) {
            try {
                const result = await this._importDocument(ref, compendiumSet, worldIdMap, strategy);
                if (result.id) {
                    worldIdMap[type].set(ref.compendiumUUID, result.id);
                    results[type][result.imported ? 'imported' : 'skipped']++;
                }
            } catch (error) {
                console.error(`Failed to import ${type} ${ref.name}:`, error);
                results[type].errors++;
            }
        }
    }

    // Second pass for journals to relink everything now that worldIdMap is complete
    console.log("Campaign Codex | Relinking imported journals...");
    for (const ref of masterRef.journals) {
        const worldDoc = game.journal.find(j => j.getFlag(this.CONSTANTS.FLAG_SCOPE, "originalId") === ref.originalId);
        if (!worldDoc) continue;

        const compendiumDoc = await fromUuid(ref.compendiumUUID);
        if (!compendiumDoc) continue;

        const compendiumData = compendiumDoc.getFlag(this.CONSTANTS.FLAG_SCOPE, this.CONSTANTS.FLAG_DATA) || {};
        const convertedData = this._convertUUIDsToWorldIds(compendiumData, worldIdMap);

        await worldDoc.setFlag(this.CONSTANTS.FLAG_SCOPE, this.CONSTANTS.FLAG_DATA, convertedData);
    }

    return results;
}

  static async _importDocument(ref, compendiumSet, worldIdMap, strategy) {
    const { FLAG_SCOPE, FLAG_DATA } = this.CONSTANTS;
    const docType = ref.compendiumUUID.split('.')[2]; // Actor, Item, or JournalEntry
    const collection = docType === "JournalEntry" ? "journal" : `${docType.toLowerCase()}s`;
    
    const existing = game[collection].find(d => d.getFlag(FLAG_SCOPE, "originalId") === ref.originalId || d.name === ref.name);
    
    if (existing && strategy === 'merge') {
        return { id: existing.id, imported: false };
    }

    const compendiumDoc = await fromUuid(ref.compendiumUUID);
    if (!compendiumDoc) throw new Error(`${docType} not found in compendium: ${ref.compendiumUUID}`);

    const importData = compendiumDoc.toObject();
    delete importData._id;

    // Clear data for journals; it will be relinked in the second pass
    if (docType === "JournalEntry") {
        foundry.utils.setProperty(importData, `flags.${FLAG_SCOPE}.${FLAG_DATA}`, {});
    }

    if (existing && strategy === 'overwrite') {
        await existing.update(importData);
        if (ref.type) await existing.setFlag("core", "sheetClass", this._getSheetClass(ref.type));
        return { id: existing.id, imported: true }; // Considered an import/update
    } else {
        const created = await globalThis[docType].create(importData);
        if (ref.type) await created.setFlag("core", "sheetClass", this._getSheetClass(ref.type));
        return { id: created.id, imported: true };
    }
}
  
  static _convertUUIDsToWorldIds(data, worldIdMap) {
    const converted = foundry.utils.deepClone(data);
    const getWorldId = (uuid, type) => {
        if (typeof uuid !== 'string' || !uuid.startsWith('Compendium.')) return uuid; // Already a world ID or invalid
        return worldIdMap[type]?.get(uuid) || null;
    };

    // Convert single references
    if (converted.linkedActor) converted.linkedActor = getWorldId(converted.linkedActor, 'actors');
    if (converted.linkedLocation) converted.linkedLocation = getWorldId(converted.linkedLocation, 'journals');

    // Convert array references
    const journalArrayFields = ['linkedNPCs', 'linkedShops', 'linkedLocations', 'associates'];
    journalArrayFields.forEach(field => {
        if (Array.isArray(converted[field])) {
            converted[field] = converted[field].map(uuid => getWorldId(uuid, 'journals')).filter(Boolean);
        }
    });

    // Convert inventory
    if (Array.isArray(converted.inventory)) {
        converted.inventory = converted.inventory.map(item => {
            const worldId = getWorldId(item.itemId, 'items');
            if (worldId) item.itemId = worldId;
            return item;
        }).filter(item => item.itemId);
    }
    
    return converted;
  }

  // ===========================================
  // MASTER REFERENCE DOCUMENT
  // ===========================================

  static async _createMasterReference(exportData, compendiums, uuidMap, config) {
    const { FLAG_SCOPE, FLAG_IS_MASTER, FLAG_MASTER_DATA, MASTER_REF_NAME } = this.CONSTANTS;

    const masterRefData = {
      // ... (metadata like exportedAt, worldId, etc.)
      actors: exportData.actors.map(d => ({ originalId: d.id, name: d.name, compendiumUUID: uuidMap.actors.get(d.id) })),
      items: exportData.items.map(d => ({ originalId: d.id, name: d.name, compendiumUUID: uuidMap.items.get(d.id) })),
      journals: exportData.journals.map(d => ({ originalId: d.id, name: d.name, type: d.getFlag(FLAG_SCOPE, "type"), compendiumUUID: uuidMap.journals.get(d.id) })),
    };
    
    const content = `<h1>Campaign Codex Export</h1><p><strong>⚠️ DO NOT DELETE.</strong> This contains data required for import.</p>`;
    
    const refDocData = {
      name: MASTER_REF_NAME,
      pages: [{ name: "Reference Data", type: "text", text: { content, format: 1 } }],
      flags: { [FLAG_SCOPE]: { [FLAG_IS_MASTER]: true, [FLAG_MASTER_DATA]: masterRefData } }
    };

    // Check for existing master reference to update it
    const packIndex = await compendiums.journals.getIndex();
    const existingRef = packIndex.find(e => e.name === MASTER_REF_NAME);
    if (existingRef) {
        refDocData._id = existingRef._id;
        const doc = await compendiums.journals.getDocument(existingRef._id);
        return await doc.update(refDocData);
    }

    return await JournalEntry.create(refDocData, { pack: compendiums.journals.collection });
  }

  static async _loadMasterReference(journalPack) {
    const { FLAG_SCOPE, FLAG_IS_MASTER, FLAG_MASTER_DATA, MASTER_REF_NAME } = this.CONSTANTS;
    const index = await journalPack.getIndex({ fields: [`flags.${FLAG_SCOPE}`] });
    const refEntry = index.find(e => e.name === MASTER_REF_NAME || foundry.utils.getProperty(e, `flags.${FLAG_SCOPE}.${FLAG_IS_MASTER}`));
    
    if (refEntry) {
        const doc = await journalPack.getDocument(refEntry._id);
        return doc?.getFlag(FLAG_SCOPE, FLAG_MASTER_DATA) || null;
    }
    return null;
  }

// ===========================================
  // UTILITY & UI METHODS
  // ===========================================

  /**
   * Prompts the user to enter a base name for the new compendium set.
   * @returns {Promise<Object|null>} An object with the baseName or null if canceled.
   * @private
   */
  static async _getExportConfig() {
    return new Promise((resolve) => {
      new Dialog({
        title: "Export Campaign Codex",
        content: `
          <form class="flexcol">
            <div class="form-group">
              <label>Compendium Set Name:</label>
              <input type="text" name="baseName" value="My Campaign" style="width: 100%;" />
              <p style="font-size: 11px; color: #666; margin: 4px 0;">
                Creates: <strong>[Name] - CC Journals/Actors/Items</strong>
              </p>
            </div>
          </form>
        `,
        buttons: {
          export: {
            icon: '<i class="fas fa-download"></i>',
            label: "Export",
            callback: (html) => {
              const baseName = html.find('[name="baseName"]').val()?.trim();
              resolve({ baseName: baseName || "My Campaign" });
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "export"
      }).render(true);
    });
  }

  /**
   * Creates a set of three compendiums (Journals, Actors, Items) for the export.
   * @param {string} baseName - The base name for the compendium set.
   * @returns {Promise<Object|null>} An object containing the three compendium packs, or null on failure.
   * @private
   */
  static async _createCompendiumSet(baseName) {
    try {
      const compendiums = {
        journals: await this._createCompendium(`${baseName} - CC Journals`, "JournalEntry"),
        actors: await this._createCompendium(`${baseName} - CC Actors`, "Actor"),
        items: await this._createCompendium(`${baseName} - CC Items`, "Item")
      };

      // Tag all compendiums as a Campaign Codex set for easy identification later
      const setId = foundry.utils.randomID();
      const timestamp = Date.now();

      for (const [type, compendium] of Object.entries(compendiums)) {
        await compendium.configure({
          flags: {
            [this.CONSTANTS.FLAG_SCOPE]: {
              isExportSet: true,
              setId: setId,
              setName: baseName,
              type: type, // 'journals', 'actors', or 'items'
              exportedAt: timestamp
            }
          }
        });
      }
      return compendiums;
    } catch (error) {
      ui.notifications.error("Failed to create compendium set!");
      console.error("Campaign Codex |", error);
      return null;
    }
  }

  /**
   * Creates a single compendium pack if it doesn't already exist.
   * @param {string} name - The user-facing label for the compendium.
   * @param {string} documentType - The type of document (e.g., 'Actor', 'Item').
   * @returns {Promise<CompendiumCollection>} The existing or newly created compendium pack.
   * @private
   */
  static async _createCompendium(name, documentType) {
    const slug = name.slugify({strict: true});
    const packId = `world.${slug}`;
    const existing = game.packs.get(packId);

    if (existing) {
      ui.notifications.info(`Using existing compendium: ${name}`);
      return existing;
    }

    ui.notifications.info(`Creating new compendium: ${name}`);
    return await CompendiumCollection.createCompendium({
      type: documentType,
      label: name,
      name: slug,
      pack: packId, // Required in newer Foundry versions
      system: game.system.id
    });
  }

  /**
   * Prompts the user to select an existing Campaign Codex compendium set to import from.
   * @returns {Promise<Object|null>} The selected compendium set or null if canceled.
   * @private
   */
  static async _selectCompendiumSet() {
    const { FLAG_SCOPE } = this.CONSTANTS;
    const sets = new Map();

    // Find compendium sets by flags first
    for (const pack of game.packs) {
      const ccFlags = pack.metadata?.flags?.[FLAG_SCOPE];
      if (!ccFlags?.isExportSet) continue;

      const { setId, setName, type, exportedAt } = ccFlags;
      if (!setId || !setName || !type) continue;

      if (!sets.has(setId)) {
        sets.set(setId, { id: setId, name: setName, exportedAt, compendiums: {} });
      }
      sets.get(setId).compendiums[type] = pack;
    }

    if (sets.size === 0) {
      ui.notifications.warn("No Campaign Codex compendium sets found!");
      return null;
    }
    
    // Filter for complete sets
    const completeSets = Array.from(sets.values()).filter(s => s.compendiums.journals && s.compendiums.actors && s.compendiums.items);

    if (completeSets.length === 0) {
        ui.notifications.warn("No complete Campaign Codex sets found. Ensure a set has Journals, Actors, and Items packs.");
        return null;
    }

    return new Promise((resolve) => {
      const setOptions = completeSets.map(set => {
        const date = set.exportedAt ? new Date(set.exportedAt).toLocaleDateString() : "Unknown date";
        return `<option value="${set.id}">${set.name} (${date})</option>`;
      }).join('');

      new Dialog({
        title: "Import Campaign Codex",
        content: `
          <form class="flexcol">
            <div class="form-group">
              <label>Select Compendium Set:</label>
              <select name="setId" style="width: 100%;">${setOptions}</select>
            </div>
          </form>
        `,
        buttons: {
          import: {
            icon: '<i class="fas fa-upload"></i>',
            label: "Import",
            callback: (html) => {
              const setId = html.find('[name="setId"]').val();
              const selectedSet = completeSets.find(s => s.id === setId);
              resolve(selectedSet?.compendiums || null);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "import"
      }).render(true);
    });
  }
  
  /**
   * Prompts the user to select an import strategy for handling conflicts.
   * @returns {Promise<string|null>} 'merge' or 'overwrite', or null if canceled.
   * @private
   */
  static async _getImportStrategy() {
    return new Promise((resolve) => {
      new Dialog({
        title: "Import Strategy",
        content: `
          <form class="flexcol">
            <div class="form-group">
              <label>How should conflicts with existing documents be handled?</label>
              <select name="strategy" style="width: 100%;">
                <option value="merge">Merge (Skip existing documents by name)</option>
                <option value="overwrite">Overwrite (Replace existing documents by name)</option>
              </select>
              <p style="font-size: 11px; color: #666; margin: 4px 0;">
                "Name" refers to the Actor, Item, or Journal name. It is recommended to use "Merge" unless you are intentionally updating content.
              </p>
            </div>
          </form>
        `,
        buttons: {
          proceed: { icon: '<i class="fas fa-check"></i>', label: "Proceed", callback: (html) => resolve(html.find('[name="strategy"]').val()) },
          cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) }
        },
        default: "proceed"
      }).render(true);
    });
  }

  /**
   * Prompts the user to confirm the export details.
   * @param {Object} exportData - The collected data to be exported.
   * @param {string} baseName - The name of the compendium set.
   * @returns {Promise<boolean>} True if confirmed, false if canceled.
   * @private
   */
  static async _confirmExport(exportData, baseName) {
    return new Promise((resolve) => {
      new Dialog({
        title: "Confirm Export",
        content: `
          <div class="flexcol">
            <p>Ready to export to "<strong>${baseName}</strong>":</p>
            <ul>
              <li><strong>${exportData.journals.length}</strong> Campaign Codex journals</li>
              <li><strong>${exportData.actors.length}</strong> linked actors</li>
              <li><strong>${exportData.items.length}</strong> linked items</li>
            </ul>
            <p><em>All relationships will be preserved. Existing compendiums will be updated.</em></p>
          </div>
        `,
        buttons: {
          confirm: { icon: '<i class="fas fa-check"></i>', label: "Export Now", callback: () => resolve(true) },
          cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(false) }
        },
        default: "confirm"
      }).render(true);
    });
  }

  /**
   * Gets the correct sheet class string for a given Campaign Codex document type.
   * @param {string} type - The codex type (e.g., 'npc', 'location').
   * @returns {string|null} The sheet class string or null.
   * @private
   */
  static _getSheetClass(type) {
    const sheetClasses = {
      "location": `${this.CONSTANTS.FLAG_SCOPE}.LocationSheet`,
      "shop": `${this.CONSTANTS.FLAG_SCOPE}.ShopSheet`,
      "npc": `${this.CONSTANTS.FLAG_SCOPE}.NPCSheet`,
      "region": `${this.CONSTANTS.FLAG_SCOPE}.RegionSheet`
    };
    return sheetClasses[type] || null;
  }

  /**
   * Displays a notification summarizing the results of the import.
   * @param {Object} results - The results object from the import process.
   * @private
   */
  static _reportImportResults(results) {
    const { journals, actors, items } = results;
    const totalErrors = journals.errors + actors.errors + items.errors;
    
    let message = `Import complete!\n`;
    message += `• Journals: ${journals.imported} imported, ${journals.skipped} skipped\n`;
    message += `• Actors: ${actors.imported} imported, ${actors.skipped} skipped\n`;
    message += `• Items: ${items.imported} imported, ${items.skipped} skipped`;
    
    if (totalErrors === 0) {
      ui.notifications.info(message);
    } else {
      ui.notifications.warn(`${message}\n${totalErrors} errors occurred. Please check the console (F12) for details.`);
    }
  }

  /**
   * If enabled, moves imported documents into organized folders by type.
   * @private
   */
  static async _organizeImportedDocuments() {
    try {
      const folderDefs = {
        "Campaign Codex - NPCs": { type: "npc", color: "#fd7e14" },
        "Campaign Codex - Locations": { type: "location", color: "#28a745" },
        "Campaign Codex - Shops": { type: "shop", color: "#6f42c1" },
        "Campaign Codex - Regions": { type: "region", color: "#20c997" }
      };

      for (const [folderName, def] of Object.entries(folderDefs)) {
        let folder = game.folders.find(f => f.name === folderName && f.type === "JournalEntry");
        
        if (!folder) {
          folder = await Folder.create({
            name: folderName,
            type: "JournalEntry",
            color: def.color,
            flags: { [this.CONSTANTS.FLAG_SCOPE]: { autoOrganize: true } }
          });
        }
        
        const docsToMove = game.journal.filter(j => 
          j.getFlag(this.CONSTANTS.FLAG_SCOPE, "type") === def.type && j.folder?.id !== folder.id
        );

        if (docsToMove.length > 0) {
            const updates = docsToMove.map(doc => ({ _id: doc.id, folder: folder.id }));
            await JournalEntry.updateDocuments(updates);
        }
      }
      console.log("Campaign Codex | Organized imported documents into folders.");
    } catch (error) {
      console.warn("Campaign Codex | Failed to organize imported documents:", error);
    }
  }
}