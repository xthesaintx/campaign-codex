// Campaign Codex Journal Converter
// Converts Campaign Codex journals to standard Foundry journals
export class CampaignCodexJournalConverter {

  /**
   * Export a Campaign Codex journal to a standard Foundry journal
   * @param {JournalEntry} sourceJournal - The Campaign Codex journal to export
   * @param {Object} options - Export options
   * @returns {Promise<JournalEntry>} The created standard journal
   */
  static async exportToStandardJournal(sourceJournal, options = {}) {
    try {
      const ccType = sourceJournal.getFlag("campaign-codex", "type");
      if (!ccType) {
        ui.notifications.warn("This journal is not a Campaign Codex document");
        return null;
      }

      const ccData = sourceJournal.getFlag("campaign-codex", "data") || {};
      const customImage = sourceJournal.getFlag("campaign-codex", "image");

      // Generate content based on type
      const content = await this._generateStandardContent(sourceJournal, ccType, ccData);

      // Create the standard journal
      const standardJournalData = {
        name: options.customName || sourceJournal.name,
        img: customImage || sourceJournal.img,
        pages: [{
          name: "Content",
          type: "text",
          text: { content: content, format: 1 } // format: 1 means HTML
        }],
        flags: {
          "campaign-codex": {
            exportedFrom: {
              originalUuid: sourceJournal.uuid, // Store full UUID
              originalName: sourceJournal.name,
              originalType: ccType,
              exportedAt: Date.now()
            }
          }
        }
      };

      // Set folder
      if (options.folderId === null) {
        standardJournalData.folder = null;
      } else if (options.folderId) {
        standardJournalData.folder = options.folderId;
      } else if (sourceJournal.folder) {
        standardJournalData.folder = sourceJournal.folder.id;
      }

      const newJournal = await JournalEntry.create(standardJournalData);

      ui.notifications.info(`Exported "${sourceJournal.name}" to standard journal`);

      if (options.openAfterExport !== false) {
        newJournal.sheet.render(true);
      }

      return newJournal;

    } catch (error) {
      console.error("Campaign Codex | Export failed:", error);
      ui.notifications.error("Failed to export journal");
      return null;
    }
  }

  /**
   * Generate HTML content for standard journal based on Campaign Codex type
   */
  static async _generateStandardContent(journal, type, data) {
    let content = `<h1>${journal.name}</h1>\n`;
    content += `<p><em>Exported from Campaign Codex (${type})</em></p>\n<hr>\n`;

    switch (type) {
      case "location":
        content += await this._generateLocationContent(data);
        break;
      case "shop":
        content += await this._generateShopContent(data);
        break;
      case "npc":
        content += await this._generateNPCContent(data);
        break;
      case "region":
        content += await this._generateRegionContent(data);
        break;
      default:
        content += await this._generateGenericContent(data);
    }

    return content;
  }

  // Helper to generate a list of linked documents
  static async _generateLinkList(title, uuids) {
    if (!uuids || uuids.length === 0) return "";

    let content = `<h2>${title}</h2>\n<ul>\n`;
    // Fetch all documents in parallel for performance
    const docs = (await Promise.all(uuids.map(uuid => fromUuid(uuid)))).filter(Boolean);

    for (const doc of docs) {
      content += `<li>@UUID[${doc.uuid}]{${doc.name}}</li>\n`;
    }
    content += `</ul>\n\n`;
    return content;
  }

  static async _generateLocationContent(data) {
    let content = "";
    if (data.description) {
      content += `<h2>Description</h2>\n${data.description}\n\n`;
    }
    content += await this._generateLinkList("NPCs at this Location", data.linkedNPCs);
    content += await this._generateLinkList("Shops at this Location", data.linkedShops);
    if (data.notes) {
      content += `<h2>GM Notes</h2>\n${data.notes}\n\n`;
    }
    return content;
  }

  static async _generateShopContent(data) {
    let content = "";
    if (data.description) {
      content += `<h2>Description</h2>\n${data.description}\n\n`;
    }

    if (data.linkedLocation) {
      const location = await fromUuid(data.linkedLocation);
      if (location) {
        content += `<h2>Location</h2>\n<p>Located in @UUID[${location.uuid}]{${location.name}}</p>\n\n`;
      }
    }

    if (data.inventory && data.inventory.length > 0) {
      content += `<h2>Shop Inventory</h2>\n`;
      content += `<p><strong>Markup:</strong> ${data.markup || 1.0}x base price</p>\n`;
      content += `<table style="width: 100%; border-collapse: collapse;">\n`;
      content += `<tr style="background: #f0f0f0;"><th style="border: 1px solid #ccc; padding: 8px;">Item</th><th style="border: 1px solid #ccc; padding: 8px;">Quantity</th><th style="border: 1px solid #ccc; padding: 8px;">Price</th></tr>\n`;
      
      const itemPromises = data.inventory.map(itemData => fromUuid(itemData.itemUuid));
      const items = (await Promise.all(itemPromises)).filter(Boolean);

      for (const item of items) {
        const itemData = data.inventory.find(i => i.itemUuid === item.uuid);
        // Use optional chaining for safety
        const basePrice = item.system.price?.value || 0;
        const currency = item.system.price?.denomination || "gp";
        const finalPrice = itemData.customPrice ?? (basePrice * (data.markup || 1.0));
        
        content += `<tr>`;
        content += `<td style="border: 1px solid #ccc; padding: 8px;">@UUID[${item.uuid}]{${item.name}}</td>`;
        content += `<td style="border: 1px solid #ccc; padding: 8px;">${itemData.quantity || 1}</td>`;
        content += `<td style="border: 1px solid #ccc; padding: 8px;">${finalPrice.toFixed(2)} ${currency}</td>`;
        content += `</tr>\n`;
      }
      content += `</table>\n\n`;
    }
    
    content += await this._generateLinkList("Shop Staff", data.linkedNPCs);
    if (data.notes) {
      content += `<h2>GM Notes</h2>\n${data.notes}\n\n`;
    }
    return content;
  }

  static async _generateNPCContent(data) {
    let content = "";
    if (data.linkedActor) {
      const actor = await fromUuid(data.linkedActor);
      if (actor) {
        content += `<h2>Character Stats</h2>\n`;
        content += `<p><strong>Linked Actor:</strong> @UUID[${actor.uuid}]{${actor.name}}</p>\n`;
        // Use optional chaining for safety
        const details = actor.system.details;
        const attrs = actor.system.attributes;
        content += `<p><strong>Race/Class:</strong> ${details?.race || 'Unknown'} ${details?.class || 'Unknown'}</p>\n`;
        if (details?.level) content += `<p><strong>Level:</strong> ${details.level}</p>\n`;
        if (attrs?.ac?.value) content += `<p><strong>AC:</strong> ${attrs.ac.value}</p>\n`;
        if (attrs?.hp) content += `<p><strong>HP:</strong> ${attrs.hp.value}/${attrs.hp.max}</p>\n`;
        content += `\n`;
      }
    }

    if (data.description) {
      content += `<h2>Description</h2>\n${data.description}\n\n`;
    }
    content += await this._generateLinkList("Locations", data.linkedLocations);
    content += await this._generateLinkList("Associated Shops", data.linkedShops);
    content += await this._generateLinkList("Associates & Contacts", data.associates);
    if (data.notes) {
      content += `<h2>GM Notes</h2>\n${data.notes}\n\n`;
    }
    return content;
  }

  static async _generateRegionContent(data) {
    let content = "";
    if (data.description) {
      content += `<h2>Description</h2>\n${data.description}\n\n`;
    }
    content += await this._generateLinkList("Locations in this Region", data.linkedLocations);
    if (data.notes) {
      content += `<h2>GM Notes</h2>\n${data.notes}\n\n`;
    }
    return content;
  }

  static async _generateGenericContent(data) {
    // This function remains mostly the same as it's a simple fallback
    let content = "";
    if (data.description) content += `<h2>Description</h2>\n${data.description}\n\n`;
    if (data.notes) content += `<h2>Notes</h2>\n${data.notes}\n\n`;
    return content;
  }

  /**
   * Show export dialog with options
   */
  static async showExportDialog(sourceJournal) {
    const ccType = sourceJournal.getFlag("campaign-codex", "type");
    if (!ccType) {
      ui.notifications.warn("This journal is not a Campaign Codex document");
      return;
    }

    // Get available folders
    const folders = game.folders.filter(f => f.type === "JournalEntry");
    const folderOptions = folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');

    return new Promise((resolve) => {
      new Dialog({
        title: "Export to Standard Journal",
        content: `
          <form class="flexcol">
            <div class="form-group">
              <label>Export Name:</label>
              <input type="text" name="exportName" value="${sourceJournal.name} (Exported)" style="width: 100%;" />
            </div>
            <div class="form-group">
              <label>Target Folder:</label>
              <select name="folderId" style="width: 100%;">
                <option value="">-- Same as Original --</option>
                <option value="root">-- Root Directory --</option>
                ${folderOptions}
              </select>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" name="openAfterExport" checked />
                Open exported journal after creation
              </label>
            </div>
            <div class="form-group">
              <p style="font-size: 12px; color: #666; margin: 8px 0;">
                <i class="fas fa-info-circle"></i> 
                This will create a standard Foundry journal with all Campaign Codex data formatted as HTML content.
              </p>
            </div>
          </form>
        `,
        buttons: {
          export: {
            icon: '<i class="fas fa-book"></i>',
            label: "Export",
            callback: async (html) => {
              const formData = new FormDataExtended(html.find('form')[0]).object;
              
              const options = {
                namePrefix: "",
                openAfterExport: formData.openAfterExport
              };

              // Handle folder selection
              if (formData.folderId === "root") {
                options.folderId = null;
              } else if (formData.folderId && formData.folderId !== "") {
                options.folderId = formData.folderId;
              }

              // Handle custom name
              let customName = null;
              if (formData.exportName && formData.exportName.trim() !== "") {
                customName = formData.exportName.trim();
                options.namePrefix = "";
              }

              const result = await this.exportToStandardJournal(sourceJournal, {
                ...options,
                customName: customName
              });
              
              resolve(result);
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
   * Batch export multiple Campaign Codex journals
   */
  static async batchExport(journals, options = {}) {
    const ccJournals = journals.filter(j => j.getFlag("campaign-codex", "type"));
    
    if (ccJournals.length === 0) {
      ui.notifications.warn("No Campaign Codex journals selected");
      return [];
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    ui.notifications.info(`Exporting ${ccJournals.length} Campaign Codex journals...`);

    for (const journal of ccJournals) {
      try {
        const exported = await this.exportToStandardJournal(journal, {
          ...options,
          openAfterExport: false // Don't open during batch export
        });
        
        if (exported) {
          results.push(exported);
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Failed to export ${journal.name}:`, error);
        errorCount++;
      }
    }

    if (errorCount === 0) {
      ui.notifications.info(`Successfully exported ${successCount} journals`);
    } else {
      ui.notifications.warn(`Exported ${successCount} journals with ${errorCount} errors`);
    }

    return results;
  }
}