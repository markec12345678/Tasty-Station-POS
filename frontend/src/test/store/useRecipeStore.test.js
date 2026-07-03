import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecipeStore } from '../../store/useRecipeStore';
import axiosInstance from '../../axios/axiosInstace';

describe('useRecipeStore', () => {
    beforeEach(() => {
        useRecipeStore.setState({
            recipes: [],
            isLoading: false,
            costing: null,
        });
        vi.clearAllMocks();
    });

    // === getRecipes ===

    it('should fetch all recipes', async () => {
        const recipes = [
            { _id: 'r1', menuItem: { _id: 'm1', name: 'Burger' }, ingredients: [] },
            { _id: 'r2', menuItem: { _id: 'm2', name: 'Pizza' }, ingredients: [] },
        ];
        axiosInstance.get.mockResolvedValue({ data: { recipes } });

        await useRecipeStore.getState().getRecipes();

        expect(useRecipeStore.getState().recipes).toEqual(recipes);
        expect(useRecipeStore.getState().isLoading).toBe(false);
        expect(axiosInstance.get).toHaveBeenCalledWith('/recipes');
    });

    it('should set isLoading during fetch', async () => {
        expect(useRecipeStore.getState().isLoading).toBe(false);
        axiosInstance.get.mockReturnValue(new Promise(() => {})); // never resolves

        useRecipeStore.getState().getRecipes();

        // isLoading should be true immediately after call
        expect(useRecipeStore.getState().isLoading).toBe(true);
    });

    it('should handle empty recipes array', async () => {
        axiosInstance.get.mockResolvedValue({ data: { recipes: [] } });

        await useRecipeStore.getState().getRecipes();

        expect(useRecipeStore.getState().recipes).toEqual([]);
        expect(useRecipeStore.getState().isLoading).toBe(false);
    });

    it('should handle fetch error gracefully', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        axiosInstance.get.mockRejectedValue(new Error('Network error'));

        await useRecipeStore.getState().getRecipes();

        expect(useRecipeStore.getState().recipes).toEqual([]);
        expect(useRecipeStore.getState().isLoading).toBe(false);
        consoleSpy.mockRestore();
    });

    // === getRecipeByMenuItem ===

    it('should fetch recipe by menu item id', async () => {
        const recipe = { _id: 'r1', menuItem: 'm1', ingredients: [{ inventory: 'i1', quantity: 2 }] };
        axiosInstance.get.mockResolvedValue({ data: { recipe } });

        const result = await useRecipeStore.getState().getRecipeByMenuItem('m1');

        expect(result).toEqual(recipe);
        expect(axiosInstance.get).toHaveBeenCalledWith('/recipes/m1');
    });

    it('should return null on 404 (recipe not found)', async () => {
        axiosInstance.get.mockRejectedValue({ response: { status: 404 } });

        const result = await useRecipeStore.getState().getRecipeByMenuItem('m99');

        expect(result).toBeNull();
    });

    it('should return null and log on non-404 error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        axiosInstance.get.mockRejectedValue({ response: { status: 500 } });

        const result = await useRecipeStore.getState().getRecipeByMenuItem('m1');

        expect(result).toBeNull();
        consoleSpy.mockRestore();
    });

    // === saveRecipe (create) ===

    it('should create a new recipe (no _id)', async () => {
        const payload = { menuItem: 'm1', ingredients: [{ inventory: 'i1', quantity: 2 }] };
        axiosInstance.post.mockResolvedValue({ data: { success: true, recipe: { _id: 'r1', ...payload } } });

        const result = await useRecipeStore.getState().saveRecipe(payload);

        expect(result.success).toBe(true);
        expect(axiosInstance.post).toHaveBeenCalledWith('/recipes', payload);
    });

    it('should update existing recipe (with _id)', async () => {
        const payload = { _id: 'r1', menuItem: 'm1', ingredients: [{ inventory: 'i1', quantity: 3 }] };
        axiosInstance.post.mockResolvedValue({ data: { success: true } });

        await useRecipeStore.getState().saveRecipe(payload);

        expect(axiosInstance.post).toHaveBeenCalledWith('/recipes', payload);
    });

    it('should handle save error', async () => {
        axiosInstance.post.mockRejectedValue({ response: { data: { message: 'Validation failed' } } });

        const result = await useRecipeStore.getState().saveRecipe({ menuItem: '' });

        expect(result.success).toBe(false);
    });

    // === deleteRecipe ===

    it('should delete a recipe', async () => {
        axiosInstance.delete.mockResolvedValue({ data: { success: true } });

        const result = await useRecipeStore.getState().deleteRecipe('r1');

        expect(result.success).toBe(true);
        expect(axiosInstance.delete).toHaveBeenCalledWith('/recipes/r1');
    });

    it('should handle delete error', async () => {
        axiosInstance.delete.mockRejectedValue({ response: { data: { message: 'Not found' } } });

        const result = await useRecipeStore.getState().deleteRecipe('r99');

        expect(result.success).toBe(false);
    });

    // === getCosting ===

    it('should fetch costing for a menu item', async () => {
        const costing = {
            computedCost: 4.50,
            salePrice: 12.99,
            grossProfit: 8.49,
            marginPercent: 65.4,
            ingredients: [{ name: 'Beef', quantity: 0.2, unit: 'kg', lineCost: 3.00 }],
        };
        axiosInstance.get.mockResolvedValue({ data: { costing } });

        const result = await useRecipeStore.getState().getCosting('m1');

        expect(result).toEqual(costing);
        expect(useRecipeStore.getState().costing).toEqual(costing);
        expect(axiosInstance.get).toHaveBeenCalledWith('/recipes/m1/cost');
    });

    it('should set costing to null on 404 (no recipe)', async () => {
        axiosInstance.get.mockRejectedValue({ response: { status: 404 } });

        const result = await useRecipeStore.getState().getCosting('m99');

        expect(result).toBeNull();
        expect(useRecipeStore.getState().costing).toBeNull();
    });

    it('should set costing to null on error and log', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        axiosInstance.get.mockRejectedValue({ response: { status: 500 } });

        const result = await useRecipeStore.getState().getCosting('m1');

        expect(result).toBeNull();
        expect(useRecipeStore.getState().costing).toBeNull();
        consoleSpy.mockRestore();
    });
});
