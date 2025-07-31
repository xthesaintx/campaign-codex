# **Campaign Codex**
A linked journal tool for FoundryVTT that helps Game Masters organise regions, locations, places of interest (shops, encounters, landmarks, etc.), NPCs, and their interconnected relationships in an easy-to-use interface.

## **Overview**
Campaign Codex transforms how you manage your journals by providing specialised sheets for different types of content, automatic relationship tracking, and organisational tools. Whether you're running a small village adventure or managing a vast continent-spanning campaign, Campaign Codex keeps everything connected and easily accessible.

## **Key Features**

### **Location Management**

* Create detailed location entries with rich descriptions  
* Link NPCs and entries to specific locations  
* Organise locations within regions  
* Automatic relationship tracking between all connected elements

### **NPC Organization**

* Link actors to NPC journals for character sheet integration  
* Track NPC associations and relationships  
* Automatically discover locations through entries and direct associations  
* Support for both player character and NPC journals

### **Place of Interest (Entry) Tracking**

* Enable or disable the inventory view
* Switch between shop and loot inventory view
* Complete inventory management with custom pricing  
* Markup controls for automatic price calculation  
* NPC assignment and location linking  
* Item transfer tools for sending items to players

### **Region System**

* Hierarchical organisation of locations within regions  
* Auto-populated with entries and NPCs via linked locations  
* Relationship tracking

### **Intelligent Relationship Management**

* Bidirectional linking automatically maintains connections  
* Broken reference cleanup and validation  
* Real-time updates across all related sheets

## **Installation**

1. In FoundryVTT, go to the Add-on Modules tab  
2. Click Install Module  
3. Paste the manifest URL: `https://raw.githubusercontent.com/xthesaintx/campaign-codex/main/module.json`  
4. Click Install  
5. Enable the module in your world

## **Quick Start Guide**

### **Creating Your First Documents**

Campaign Codex adds creation buttons to your Journal Directory:

* Region Button: Create geographical regions  
* Location Button: Create specific places within regions  
* Entry Button: Create businesses, encounters, or other places of interest  
* NPC Button: Create character journals that can link to actor sheets

### **Basic Workflow**

1. Start with a Region: Create a region for your campaign area  
2. Add Locations: Create locations and assign them to the region  
3. Populate with NPCs: Create NPC journals and link them to locations  
4. Add Entries: Create businesses, encounters or other areas of interest and link them to locations and NPCs  
5. Build Relationships: Use drag-and-drop to create connections between elements

### **Using the Interface**

Each document type features a sidebar with:

* Quick navigation tabs with relationship counts  
* Statistics showing connected elements  
* Quick links to related documents  
* Rich text editing for descriptions and notes

## **Document Types**

### **Location Sheets**

* Info Tab: Description and region assignment  
* NPCs Tab: Both directly assigned and shop-based NPCs  
* Entries Tab: All Places of Interest at this location  
* Notes Tab: Private GM notes

### **NPC Sheets**

* Info Tab: Actor linking and character description  
* Locations Tab: All associated locations (direct and through entries)  
* Entries Tab: Places of Interest where this NPC is linked  
* Associates Tab: Connected NPCs and relationships  
* Notes Tab: Private GM notes

### **Entry (Places of Interest) Sheets**

* Info Tab: Description and location assignment  
* Inventory Tab: Full inventory management with pricing tools, a loot mode disables pricing. Inventory can be hidden.
* NPCs Tab: Linked NPCs
* Notes Tab: Private GM notes

### **Region Sheets**

* Info Tab: Regional description and overview  
* Locations Tab: All locations within the region  
* NPCs Tab: All NPCs across the region (auto-populated)  
* Entries Tab: All Places of Interest across the region (auto-populated)  
* Notes Tab: Private GM notes

## **Advanced Features**

### **Inventory Management**

* Drag & Drop: Add items from the world to shop inventories  
* Markup System: Set global or per-item pricing  
* Player Transfer: Send items directly to player character sheets  
* Quantity Controls: Manage stock levels with easy increment/decrement
* Show/Hide: Enable or Disable the Inventory tab to use as a non-business sheet
* Loot Mode: Disable pricing and markup on the inventory

### **Relationship Intelligence**

* Auto-Discovery: NPCs automatically appear in locations where they are in Entries  
* Bidirectional Links: Creating one relationship automatically creates the reverse  
* Cleanup: Deleting documents automatically removes broken references  
* Validation: Built-in checking for missing or invalid relationships

### **Export & Backup**

* Standard Journal Export: Convert Campaign Codex documents to regular journals  
* Compendium Export: Export entire campaign setups to shareable compendiums  
* Relationship Preservation: All links and connections are maintained in exports


### **Folder Organization**

Campaign Codex automatically creates and manages folders for journal creation and organisation:

* Campaign Codex \- Regions  
* Campaign Codex \- Locations  
* Campaign Codex \- Shops  
* Campaign Codex \- NPCs

## **System Compatibility**

Campaign Codex is designed to work with any game system in FoundryVTT. While some features (like actor integration) work best with systems that have character sheets, the core functionality is system-agnostic.  

## **Support & Community**

### **Getting Help**

* Check the [GitHub Issues](https://github.com/xthesaintx/campaign-codex/issues) for known problems  
* Submit bug reports with detailed information about your setup  
* Feature requests are welcome through GitHub issues

Campaign Codex \- Bringing order to your campaign chaos, one relationship at a time.
