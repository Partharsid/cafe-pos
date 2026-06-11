import { create } from "zustand";
import type { MenuItem, OrderItem } from "@/types/database";

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
  modifiers?: { groupName: string; selectedOptions: { name: string; price_modifier: number }[] }[];
  unitPrice?: number;
}

interface OrderState {
  cart: CartItem[];
  addToCart: (item: MenuItem, modifiers?: CartItem["modifiers"]) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateNotes: (itemId: string, notes: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  cart: [],
  addToCart: (item, modifiers) =>
    set((state) => {
      const modifierPrice = modifiers
        ? modifiers.reduce((sum, m) => sum + m.selectedOptions.reduce((s, o) => s + o.price_modifier, 0), 0)
        : 0;
      const unitPrice = item.price + modifierPrice;
      const existing = state.cart.find(
        (ci) => ci.menuItem.id === item.id && JSON.stringify(ci.modifiers) === JSON.stringify(modifiers)
      );
      if (existing) {
        return {
          cart: state.cart.map((ci) =>
            ci.menuItem.id === item.id && JSON.stringify(ci.modifiers) === JSON.stringify(modifiers)
              ? { ...ci, quantity: ci.quantity + 1 }
              : ci
          ),
        };
      }
      return { cart: [...state.cart, { menuItem: item, quantity: 1, notes: "", modifiers, unitPrice }] };
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
      (sum, ci) => sum + (ci.unitPrice ?? ci.menuItem.price) * ci.quantity,
      0
    ),
  getCartCount: () =>
    get().cart.reduce((sum, ci) => sum + ci.quantity, 0),
}));
