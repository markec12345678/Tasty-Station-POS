import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStockMovementStore } from '../../store/useStockMovementStore';
import axiosInstance from '../../axios/axiosInstace';

describe('useStockMovementStore', () => {
    beforeEach(() => {
        useStockMovementStore.setState({
            movements: [],
            stats: null,
            isLoading: false,
            pagination: { total: 0, totalPages: 0, currentPage: 1, limit: 50 },
        });
        vi.clearAllMocks();
    });

    // === getMovements ===

    it('should fetch movements with default params', async () => {
        const movements = [
            { _id: 'sm1', type: 'order', quantity: 2, inventory: { name: 'Beef' } },
        ];
        const pagination = { total: 1, totalPages: 1, currentPage: 1, limit: 50 };
        axiosInstance.get.mockResolvedValue({ data: { movements, pagination } });

        await useStockMovementStore.getState().getMovements();

        expect(useStockMovementStore.getState().movements).toEqual(movements);
        expect(useStockMovementStore.getState().pagination).toEqual(pagination);
        expect(useStockMovementStore.getState().isLoading).toBe(false);
        expect(axiosInstance.get).toHaveBeenCalledWith(expect.stringContaining('/stock-movements?'));
    });

    it('should build query string with filters', async () => {
        axiosInstance.get.mockResolvedValue({ data: { movements: [], pagination: {} } });

        await useStockMovementStore.getState().getMovements({
            page: 2,
            inventory: 'inv1',
            type: 'restock',
            order: 'ord1',
            outlet: 'out1',
            startDate: '2025-01-01',
            endDate: '2025-01-31',
        });

        const calledUrl = axiosInstance.get.mock.calls[0][0];
        expect(calledUrl).toContain('page=2');
        expect(calledUrl).toContain('inventory=inv1');
        expect(calledUrl).toContain('type=restock');
        expect(calledUrl).toContain('order=ord1');
        expect(calledUrl).toContain('outlet=out1');
        expect(calledUrl).toContain('startDate=2025-01-01');
        expect(calledUrl).toContain('endDate=2025-01-31');
    });

    it('should set isLoading during fetch', async () => {
        expect(useStockMovementStore.getState().isLoading).toBe(false);
        axiosInstance.get.mockReturnValue(new Promise(() => {})); // never resolves

        useStockMovementStore.getState().getMovements();

        expect(useStockMovementStore.getState().isLoading).toBe(true);
    });

    it('should handle fetch error gracefully', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        axiosInstance.get.mockRejectedValue(new Error('Network error'));

        await useStockMovementStore.getState().getMovements();

        expect(useStockMovementStore.getState().movements).toEqual([]);
        expect(useStockMovementStore.getState().isLoading).toBe(false);
        consoleSpy.mockRestore();
    });

    it('should preserve pagination on error (fallback to current)', async () => {
        const existingPagination = { total: 5, totalPages: 1, currentPage: 1, limit: 50 };
        useStockMovementStore.setState({ pagination: existingPagination });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        axiosInstance.get.mockRejectedValue(new Error('Network error'));

        await useStockMovementStore.getState().getMovements();

        // Pagination should remain as-is (fallback to get().pagination)
        expect(useStockMovementStore.getState().pagination).toEqual(existingPagination);
        consoleSpy.mockRestore();
    });

    // === getStats ===

    it('should fetch stats without date range', async () => {
        const stats = {
            totals: { totalConsumedValue: 1234.50, totalMovements: 42 },
            topConsumed: [{ name: 'Beef', totalConsumed: 50 }],
            byType: [{ _id: 'order', count: 30 }],
        };
        axiosInstance.get.mockResolvedValue({ data: { stats } });

        const result = await useStockMovementStore.getState().getStats();

        expect(result).toEqual(stats);
        expect(useStockMovementStore.getState().stats).toEqual(stats);
        expect(axiosInstance.get).toHaveBeenCalledWith(expect.stringContaining('/stock-movements/stats?'));
    });

    it('should fetch stats with date range', async () => {
        axiosInstance.get.mockResolvedValue({ data: { stats: {} } });

        await useStockMovementStore.getState().getStats('2025-01-01', '2025-01-31');

        const calledUrl = axiosInstance.get.mock.calls[0][0];
        expect(calledUrl).toContain('startDate=2025-01-01');
        expect(calledUrl).toContain('endDate=2025-01-31');
    });

    it('should return null on stats error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        axiosInstance.get.mockRejectedValue(new Error('Server error'));

        const result = await useStockMovementStore.getState().getStats();

        expect(result).toBeNull();
        consoleSpy.mockRestore();
    });

    // === getInventoryHistory ===

    it('should fetch history for a specific inventory item', async () => {
        const movements = [
            { _id: 'sm1', type: 'order', quantity: 2 },
            { _id: 'sm2', type: 'restock', quantity: 10 },
        ];
        axiosInstance.get.mockResolvedValue({ data: { movements } });

        const result = await useStockMovementStore.getState().getInventoryHistory('inv1');

        expect(result).toEqual(movements);
        expect(axiosInstance.get).toHaveBeenCalledWith('/stock-movements/inventory/inv1');
    });

    it('should return empty array on history error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        axiosInstance.get.mockRejectedValue(new Error('Not found'));

        const result = await useStockMovementStore.getState().getInventoryHistory('inv99');

        expect(result).toEqual([]);
        consoleSpy.mockRestore();
    });

    // === restock ===

    it('should restock inventory and refresh movements', async () => {
        const data = { inventory: 'inv1', quantity: 10, reason: 'Weekly delivery' };
        axiosInstance.post.mockResolvedValue({ data: { success: true } });
        axiosInstance.get.mockResolvedValue({ data: { movements: [], pagination: {} } });

        const result = await useStockMovementStore.getState().restock(data);

        expect(result.success).toBe(true);
        expect(axiosInstance.post).toHaveBeenCalledWith('/stock-movements/restock', data);
    });

    it('should handle restock error', async () => {
        axiosInstance.post.mockRejectedValue({ response: { data: { message: 'Insufficient data' } } });

        const result = await useStockMovementStore.getState().restock({ inventory: '' });

        expect(result.success).toBe(false);
    });

    // === adjust ===

    it('should adjust stock and refresh movements', async () => {
        const data = { inventory: 'inv1', newQuantity: 50, reason: 'Physical count' };
        axiosInstance.post.mockResolvedValue({ data: { success: true } });
        axiosInstance.get.mockResolvedValue({ data: { movements: [], pagination: {} } });

        const result = await useStockMovementStore.getState().adjust(data);

        expect(result.success).toBe(true);
        expect(axiosInstance.post).toHaveBeenCalledWith('/stock-movements/adjust', data);
    });

    it('should handle adjust error', async () => {
        axiosInstance.post.mockRejectedValue({ response: { data: { message: 'Invalid quantity' } } });

        const result = await useStockMovementStore.getState().adjust({ inventory: 'inv1', newQuantity: -5 });

        expect(result.success).toBe(false);
    });
});
