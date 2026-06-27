const ModifierGroup = require("../models/modifierGroup.model");
const { MenuItem } = require("../models/menu.model");

// GET /api/modifiers — vsi modifier groups
const getModifierGroups = async (req, res, next) => {
    try {
        const groups = await ModifierGroup.find().sort({ sortOrder: 1, name: 1 }).lean();
        res.status(200).json({ success: true, groups });
    } catch (error) { next(error); }
};

// GET /api/modifiers/:id — posamezen modifier group
const getModifierGroup = async (req, res, next) => {
    try {
        const group = await ModifierGroup.findById(req.params.id);
        if (!group) return res.status(404).json({ success: false, message: "Modifier group not found" });
        res.status(200).json({ success: true, group });
    } catch (error) { next(error); }
};

// POST /api/modifiers — ustvari nov modifier group (admin)
const createModifierGroup = async (req, res, next) => {
    try {
        const group = await ModifierGroup.create(req.body);
        res.status(201).json({ success: true, message: "Modifier group created", group });
    } catch (error) { next(error); }
};

// PUT /api/modifiers/:id — posodobi modifier group (admin)
const updateModifierGroup = async (req, res, next) => {
    try {
        const group = await ModifierGroup.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!group) return res.status(404).json({ success: false, message: "Modifier group not found" });
        res.status(200).json({ success: true, message: "Modifier group updated", group });
    } catch (error) { next(error); }
};

// DELETE /api/modifiers/:id — izbriši modifier group (admin)
const deleteModifierGroup = async (req, res, next) => {
    try {
        // Preveri ali je uporabljen na kakšnem artiklu
        const usedInItems = await MenuItem.countDocuments({ modifierGroups: req.params.id });
        if (usedInItems > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete — used by ${usedInItems} menu items. Remove reference first.`
            });
        }
        const group = await ModifierGroup.findByIdAndDelete(req.params.id);
        if (!group) return res.status(404).json({ success: false, message: "Modifier group not found" });
        res.status(200).json({ success: true, message: "Modifier group deleted" });
    } catch (error) { next(error); }
};

// POST /api/modifiers/:id/modifier — dodaj posamezni modifier v group (admin)
const addModifier = async (req, res, next) => {
    try {
        const group = await ModifierGroup.findById(req.params.id);
        if (!group) return res.status(404).json({ success: false, message: "Modifier group not found" });
        group.modifiers.push(req.body);
        await group.save();
        res.status(201).json({ success: true, message: "Modifier added", group });
    } catch (error) { next(error); }
};

// PUT /api/modifiers/:groupId/modifier/:modifierId — posodobi modifier (admin)
const updateModifier = async (req, res, next) => {
    try {
        const group = await ModifierGroup.findById(req.params.groupId);
        if (!group) return res.status(404).json({ success: false, message: "Modifier group not found" });
        const modifier = group.modifiers.id(req.params.modifierId);
        if (!modifier) return res.status(404).json({ success: false, message: "Modifier not found" });
        Object.assign(modifier, req.body);
        await group.save();
        res.status(200).json({ success: true, message: "Modifier updated", group });
    } catch (error) { next(error); }
};

// DELETE /api/modifiers/:groupId/modifier/:modifierId — izbriši modifier (admin)
const deleteModifier = async (req, res, next) => {
    try {
        const group = await ModifierGroup.findById(req.params.groupId);
        if (!group) return res.status(404).json({ success: false, message: "Modifier group not found" });
        group.modifiers.id(req.params.modifierId).deleteOne();
        await group.save();
        res.status(200).json({ success: true, message: "Modifier deleted", group });
    } catch (error) { next(error); }
};

module.exports = {
    getModifierGroups, getModifierGroup,
    createModifierGroup, updateModifierGroup, deleteModifierGroup,
    addModifier, updateModifier, deleteModifier,
};
