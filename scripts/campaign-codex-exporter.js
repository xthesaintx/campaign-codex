// Campaign Codex Exporter - Revised for UUID-based systems
export class SimpleCampaignCodexExporter {
  static CONSTANTS = {
    FLAG_SCOPE: "campaign-codex",
    FLAG_TYPE: "type",
    FLAG_DATA: "data",
  };

  // ===========================================
  // PRIMARY PUBLIC METHOD
  // ===========================================

  /**
   * The main entry point for the export process.
   */
  static async exportCampaignCodexToCompendium() {
    try {
      // 1. Get user configuration for the export (e.g., compendium name)
      const config = await this._getExportConfig();
      if (!config) return; // User cancelled

      // 2. Create the set of new compendiums inside a dedicated folder
      const compendiums = await this._createCompendiumSet(config.baseName);
      if (!compendiums) return;

      // 3. Collect all world journals and their linked documents
      ui.notifications.info("Collecting all linked documents...");
      const exportData = await this._collectExportData();
      if (exportData.journals.size === 0) {
        ui.notifications.warn("No Campaign Codex documents found to export!");
        return;
      }

      // 4. Confirm the export with the user
      const confirmed = await this._confirmExport(exportData, config.baseName);
      if (!confirmed) return;

      // 5. Perform the actual export and relinking
      ui.notifications.info(`Exporting ${exportData.journals.size} journals, ${exportData.actors.size} actors, and ${exportData.items.size} items...`);
      await this._performExport(exportData, compendiums);

      ui.notifications.info(`Export complete! Compendium set "${config.baseName}" is ready.`);

    } catch (error) {
      console.error("Campaign Codex | Export Error:", error);
      ui.notifications.error(`Export failed: ${error.message}`);
    }
  }

  // ===========================================
  // DATA COLLECTION (Step 3)
  // ===========================================

  /**
   * Recursively finds all documents to be exported, starting from world journals.
   * @returns {Promise<{journals: Set<JournalEntry>, actors: Set<Actor>, items: Set<Item>}>}
   */
  static async _collectExportData() {
    const documents = {
      journals: new Set(),
      actors: new Set(),
      items: new Set(),
    };
    const processedUuids = new Set(); // Prevents infinite loops

    // Start with all Campaign Codex journals in the world
    const rootJournals = game.journal.filter(j => j.getFlag(this.CONSTANTS.FLAG_SCOPE, this.CONSTANTS.FLAG_TYPE));

    for (const journal of rootJournals) {
      await this._recursivelyFindDocuments(journal.uuid, documents, processedUuids);
    }

    return documents;
  }

  /**
   * Given a starting UUID, finds the document and all documents it links to.
   * @param {string} uuid - The UUID of the document to process.
   * @param {object} documents - The main object holding Sets of journals, actors, and items.
   * @param {Set<string>} processedUuids - A set of already-handled UUIDs to avoid redundant work.
   */
  static async _recursivelyFindDocuments(uuid, documents, processedUuids) {
    if (!uuid || processedUuids.has(uuid)) {
      return;
    }
    processedUuids.add(uuid);

    const doc = await fromUuid(uuid);
    if (!doc) {
      console.warn(`Campaign Codex | Linked document not found for UUID: ${uuid}`);
      return;
    }

    // Add the resolved document to the correct set
    if (doc.documentName === "JournalEntry") {
      documents.journals.add(doc);
    } else if (doc.documentName === "Actor") {
      documents.actors.add(doc);
    } else if (doc.documentName === "Item") {
      documents.items.add(doc);
    }

    // Now, find all UUIDs within this document and process them
    const linkedUuids = this._extractUuidsFromDocument(doc);
    for (const linkedUuid of linkedUuids) {
      await this._recursivelyFindDocuments(linkedUuid, documents, processedUuids);
    }
  }

  /**
   * Extracts all known UUIDs from a single Campaign Codex document's flags.
   * @param {Document} doc - The document to parse.
   * @returns {string[]} An array of all found UUIDs.
   */
  static _extractUuidsFromDocument(doc) {
    if (doc.documentName !== "JournalEntry") {
        return []; // Only journals have the codex data structure
    }

    const codexData = doc.getFlag(this.CONSTANTS.FLAG_SCOPE, this.CONSTANTS.FLAG_DATA) || {};
    const uuids = [];

    // Fields that contain a single UUID
    const singleLinkFields = ["linkedActor", "linkedLocation", "parentRegion"];
    for (const field of singleLinkFields) {
      if (codexData[field]) {
        uuids.push(codexData[field]);
      }
    }

    // Fields that contain an array of UUIDs
    const multiLinkFields = ["linkedNPCs", "linkedShops", "linkedLocations", "associates"];
    for (const field of multiLinkFields) {
      if (Array.isArray(codexData[field])) {
        uuids.push(...codexData[field]);
      }
    }

    // Special handling for inventory items
    if (Array.isArray(codexData.inventory)) {
      for (const item of codexData.inventory) {
        if (item.itemUuid) {
          uuids.push(item.itemUuid);
        }
      }
    }

    return uuids.filter(Boolean); // Filter out any null/undefined entries
  }


  // ===========================================
  // EXPORT PROCESS (Step 5)
  // ===========================================

  /**
   * Exports all collected documents and updates their links.
   * @param {object} exportData - The object containing Sets of documents to export.
   * @param {object} compendiums - The object containing the created compendium packs.
   */
  static async _performExport(exportData, compendiums) {
    const uuidMap = new Map();
    const compendiumFolders = {
        journals: new Map(), // Map<folderName, folderId>
        actors: new Map(),
        items: new Map()
    };

    // --- PASS 1: EXPORT ALL DOCUMENTS AND BUILD THE UUID MAP ---
    // This pass populates the compendiums and maps old UUIDs to new compendium UUIDs.

    for (const actor of exportData.actors) {
      const newDoc = await this._exportDocument(actor, compendiums.actors, compendiumFolders.actors);
      uuidMap.set(actor.uuid, newDoc.uuid);
    }
    for (const item of exportData.items) {
      const newDoc = await this._exportDocument(item, compendiums.items, compendiumFolders.items);
      uuidMap.set(item.uuid, newDoc.uuid);
    }
    for (const journal of exportData.journals) {
      const newDoc = await this._exportDocument(journal, compendiums.journals, compendiumFolders.journals);
      uuidMap.set(journal.uuid, newDoc.uuid);
    }

    // --- PASS 2: UPDATE THE EXPORTED JOURNALS WITH NEW LINKS ---
    // Now that we have the complete uuidMap, we can update the journals in the compendium.
    const updates = [];
    for (const journal of exportData.journals) {
      const newJournalUuid = uuidMap.get(journal.uuid);
      if (!newJournalUuid) continue;

      // The document in the compendium has a different ID, but we can find it via its UUID.
      const newJournal = await fromUuid(newJournalUuid);
      if (!newJournal) continue;

      updates.push(this._prepareJournalUpdate(newJournal, uuidMap));
    }

    if (updates.length > 0) {
      await JournalEntry.updateDocuments(updates, { pack: compendiums.journals.collection });
    }
  }

  /**
   * Creates a data object for updating a journal in the compendium with relinked UUIDs.
   * @param {JournalEntry} journal - The journal *in the compendium* to be updated.
   * @param {Map<string, string>} uuidMap - The map of old UUIDs to new compendium UUIDs.
   * @returns {object} The data object for the update operation.
   */
  static _prepareJournalUpdate(journal, uuidMap) {
    const updateData = { _id: journal.id };

    // 1. Relink the `flags.campaign-codex.data` object
    const oldCodexData = journal.getFlag(this.CONSTANTS.FLAG_SCOPE, this.CONSTANTS.FLAG_DATA) || {};
    const newCodexData = foundry.utils.deepClone(oldCodexData);

    const relink = (uuid) => uuidMap.get(uuid) || uuid;

    // Relink single UUID fields
    const singleLinkFields = ["linkedActor", "linkedLocation", "parentRegion"];
    for (const field of singleLinkFields) {
        if (newCodexData[field]) newCodexData[field] = relink(newCodexData[field]);
    }

    // Relink array UUID fields
    const multiLinkFields = ["linkedNPCs", "linkedShops", "linkedLocations", "associates"];
    for (const field of multiLinkFields) {
        if (Array.isArray(newCodexData[field])) {
            newCodexData[field] = newCodexData[field].map(relink);
        }
    }

    // Relink inventory
    if (Array.isArray(newCodexData.inventory)) {
        newCodexData.inventory.forEach(item => {
            if (item.itemUuid) item.itemUuid = relink(item.itemUuid);
        });
    }
    
    foundry.utils.setProperty(updateData, `flags.${this.CONSTANTS.FLAG_SCOPE}.${this.CONSTANTS.FLAG_DATA}`, newCodexData);

    // 2. Relink @UUID links in all journal pages' text content
    const newPages = journal.pages.map(page => {
        const pageData = page.toObject();
        if (pageData.text?.content) {
            pageData.text.content = pageData.text.content.replace(/@UUID\[([^\]]+)\]/g, (match, oldUuid) => {
                const newUuid = uuidMap.get(oldUuid);
                return newUuid ? `@UUID[${newUuid}]` : match;
            });
        }
        return pageData;
    });
    updateData.pages = newPages;

    return updateData;
  }

  /**
   * Exports a single document to a target compendium, creating folders as needed.
   * @param {Document} doc - The document to export.
   * @param {CompendiumCollection} targetPack - The compendium to export to.
   * @param {Map<string, string>} folderMap - A map to track created folders in the pack.
   * @returns {Promise<Document>} The newly created document in the compendium.
   */
  static async _exportDocument(doc, targetPack, folderMap) {
    const exportData = doc.toObject();
    delete exportData._id;

    foundry.utils.setProperty(exportData, `flags.${this.CONSTANTS.FLAG_SCOPE}.originalUuid`, doc.uuid);
    
    // **NEW FOLDER LOGIC**
    if (doc.folder) {
        const folderName = doc.folder.name;
        let targetFolderId = folderMap.get(folderName);

        if (!targetFolderId) {
            // Folder doesn't exist in the compendium yet, so create it.
            console.log(`Campaign Codex | Creating folder "${folderName}" in compendium "${targetPack.metadata.label}"`);
            const newFolder = await Folder.create({
                name: folderName,
                type: doc.documentName,
                sorting: doc.folder.sorting,
                color: doc.folder.color
            }, { pack: targetPack.collection });

            targetFolderId = newFolder.id;
            folderMap.set(folderName, targetFolderId);
        }
        
        // Assign the document to the folder
        exportData.folder = targetFolderId;
    }
    
    return await targetPack.importDocument(doc.clone(exportData, {"keepId": false}));
  }

  // ===========================================
  // UI & UTILITY METHODS
  // ===========================================

  /**
   * Prompts the user to enter a base name for the new compendium set.
   * @returns {Promise<Object|null>}
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
                This will create a set of compendiums, e.g., <strong>[Name] - CC Journals</strong>.
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
   * Creates a set of three compendiums for the export inside a main folder.
   * @param {string} baseName - The base name for the compendium set.
   * @returns {Promise<Object|null>}
   */
  static async _createCompendiumSet(baseName) {
    try {
      // **NEW** Create the parent folder in the Compendium sidebar.
      const FOLDER_NAME = "Campaign Codex Exports";
      let compendiumFolder = game.folders.find(f => f.name === FOLDER_NAME && f.type === "Compendium");
      if (!compendiumFolder) {
          console.log(`Campaign Codex | Creating compendium folder "${FOLDER_NAME}"`);
          compendiumFolder = await Folder.create({
              name: FOLDER_NAME,
              type: "Compendium",
              color: "#198556", // A nice green color
              sorting: "a"
          });
      }

      // Create the compendiums inside that folder.
      const compendiums = {
        journals: await this._createCompendium(`${baseName} - CC Journals`, "JournalEntry", compendiumFolder.id),
        actors: await this._createCompendium(`${baseName} - CC Actors`, "Actor", compendiumFolder.id),
        items: await this._createCompendium(`${baseName} - CC Items`, "Item", compendiumFolder.id)
      };
      return compendiums;
    } catch (error) {
      ui.notifications.error("Failed to create compendium set!");
      console.error("Campaign Codex |", error);
      return null;
    }
  }

  /**
   * Creates a single compendium pack, overwriting if it already exists.
   * @param {string} name - The user-facing label for the compendium.
   * @param {string} documentType - The type of document.
   * @param {string} folderId - The ID of the parent folder in the compendium sidebar.
   * @returns {Promise<CompendiumCollection>}
   */
  static async _createCompendium(name, documentType, folderId) {
    const slug = name.slugify({strict: true});
    const packId = `world.${slug}`;
    const existing = game.packs.get(packId);

    if (existing) {
      const confirmed = await Dialog.confirm({
        title: "Overwrite Compendium?",
        content: `<p>A compendium named "<strong>${name}</strong>" already exists. Do you want to delete and recreate it? This cannot be undone.</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false
      });
      if (!confirmed) {
        throw new Error(`User cancelled overwrite of compendium: ${name}`);
      }
      await existing.deleteCompendium();
      ui.notifications.info(`Recreating compendium: ${name}`);
    } else {
      ui.notifications.info(`Creating new compendium: ${name}`);
    }
    
    // **FIX**: Per user's research, the correct method is to create the compendium
    // and then assign the folder in a separate step using `setFolder`.
    const pack = await CompendiumCollection.createCompendium({
      type: documentType,
      label: name,
      name: slug,
      pack: packId,
      system: game.system.id
    });
    
    if (folderId) {
      await pack.setFolder(folderId);
    }
    
    return pack;
  }
// await game.packs.get("world.my-campaign-cc-items").setFolder("xvdy9QsPp1ITklF5")

  /**
   * Prompts the user to confirm the export details.
   * @param {object} exportData - The collected data to be exported.
   * @param {string} baseName - The name of the compendium set.
   * @returns {Promise<boolean>}
   */
  static async _confirmExport(exportData, baseName) {
    return new Promise((resolve) => {
      new Dialog({
        title: "Confirm Export",
        content: `
          <div class="flexcol">
            <p>Ready to export the following to the "<strong>${baseName}</strong>" compendium set:</p>
            <ul style="margin: 0.5rem 0;">
              <li><strong>${exportData.journals.size}</strong> Campaign Codex journals</li>
              <li><strong>${exportData.actors.size}</strong> linked actors</li>
              <li><strong>${exportData.items.size}</strong> linked items</li>
            </ul>
            <p><em>All relationships and folders will be preserved.</em></p>
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
}
