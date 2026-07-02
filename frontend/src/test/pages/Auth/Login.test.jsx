import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../../pages/Auth/Login';
import { useAuthStore } from '../../../store/useAuthStore';

// Mock useAuthStore
vi.mock('../../../store/useAuthStore', () => ({
    useAuthStore: vi.fn()
}));

describe('Login Page', () => {
    const mockLogin = vi.fn();

    beforeEach(() => {
        useAuthStore.mockReturnValue({
            login: mockLogin,
            isLoading: false
        });
        vi.clearAllMocks();
    });

    it('renders login form correctly', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        // More robust queries that don't depend on specific icon/text node layouts.
        // i18n mock vrne key, zato iščemo i18n key-e (ne angleških prevodov).
        expect(screen.getByPlaceholderText(/name@example.com/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
        expect(screen.getByText(/login\.signIn/i)).toBeInTheDocument();
    });

    it('updates input fields on change', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        const emailInput = screen.getByPlaceholderText(/name@example.com/i);
        const passwordInput = screen.getByPlaceholderText(/••••••••/i);

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        expect(emailInput.value).toBe('test@example.com');
        expect(passwordInput.value).toBe('password123');
    });

    it('calls login function on form submission', async () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        const emailInput = screen.getByPlaceholderText(/name@example.com/i);
        const passwordInput = screen.getByPlaceholderText(/••••••••/i);
        const submitButton = screen.getByText(/login\.signIn/i);

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
                rememberMe: false
            });
        });
    });

    it('shows loading state on button when isLoading is true', () => {
        useAuthStore.mockReturnValue({
            login: mockLogin,
            isLoading: true
        });

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        // i18n mock vrne key; komponenta prikaže t('login.signingIn') ko isLoading=true.
        expect(screen.getByText(/login\.signingIn/i)).toBeInTheDocument();
        // Check the specific button that shows the loading text
        const button = screen.getByText(/login\.signingIn/i).closest('button');
        expect(button).toBeDisabled();
    });
});
