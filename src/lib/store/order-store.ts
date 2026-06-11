import { create } from "zustand";
import type { MenuItem, OrderItem } from "@/types/database";

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

interface OrderState {
  cart: CartItem[];
  addToCart: (item: MenuItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateNotes: (itemId: string, notes: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  cart: [],
  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((ci) => ci.menuItem.id === item.id);
      if (existing) {
        return {
          cart: state.cart.map((ci) =>
            ci.menuItem.id === item.id
              ? { ...ci, quantity: ci.quantity + 1 }
              : ci
          ),
        };
      }
      return { cart: [...state.cart, { menuItem: item, quantity: 1, notes: "" }] };
    }),
  removeFromCart: (itemId) =>
    set((state) => ({
      cart: state.cart.filter((ci) => ci.menuItem.id !== itemId),
    })),
  updateQuantity: (itemId, quantity) =>
    set((state) => ({
      cart: quantity <= 0
        ? state.cart.filter((ci) => ci.menuItem.id !== itemId)
        : state.cart.map((ci) =>
            ci.menuItem.id === itemId ? { ...ci, quantity } : ci
          ),
    })),
  updateNotes: (itemId, notes) =>
    set((state) => ({
      cart: state.cart.map((ci) =>
        ci.menuItem.id === itemId ? { ...ci, notes } : ci
      ),
    })),
  clearCart: () => set({ cart: [] }),
  getCartTotal: () =>
    get().cart.reduce(
      (sum, ci) => sum + ci.menuItem.price * ci.quantity,
      0
    ),
  getCartCount: () =>
    get().cart.reduce((sum, ci) => sum + ci.quantity, 0),
}));
