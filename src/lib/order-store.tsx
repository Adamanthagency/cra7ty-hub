'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import type { OrderLine, Product } from '@/lib/types';

/**
 * The whole site has one order: a list of lines kept in a context so the
 * product cards, the drawer and the sticky nav can all read the same count.
 * Persisted to localStorage because half-built orders should survive a reload.
 */

const STORAGE_KEY = 'cra7ty-hub.order.v1';

type Action =
  | { type: 'add'; product: Product; quantity: number }
  | { type: 'setQuantity'; productId: string; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; lines: OrderLine[] };

function reducer(state: OrderLine[], action: Action): OrderLine[] {
  switch (action.type) {
    case 'hydrate':
      return action.lines;
    case 'add': {
      const { product, quantity } = action;
      const existing = state.find((l) => l.productId === product.id);
      if (existing) {
        return state.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + quantity } : l,
        );
      }
      return [
        ...state,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          unitPrice: product.price,
          quantity,
          model: product.model,
        },
      ];
    }
    case 'setQuantity':
      return action.quantity <= 0
        ? state.filter((l) => l.productId !== action.productId)
        : state.map((l) =>
            l.productId === action.productId ? { ...l, quantity: action.quantity } : l,
          );
    case 'remove':
      return state.filter((l) => l.productId !== action.productId);
    case 'clear':
      return [];
    default:
      return state;
  }
}

interface OrderContextValue {
  lines: OrderLine[];
  count: number;
  total: number;
  isOpen: boolean;
  lastAddedId: string | null;
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
}

const OrderContext = createContext<OrderContextValue | null>(null);

function readStored(): OrderLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is OrderLine =>
        !!l &&
        typeof l === 'object' &&
        typeof (l as OrderLine).productId === 'string' &&
        typeof (l as OrderLine).quantity === 'number' &&
        (l as OrderLine).quantity > 0,
    );
  } catch {
    return [];
  }
}

export function OrderProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(reducer, []);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // hydrate after mount so server and client markup match
  useEffect(() => {
    const stored = readStored();
    if (stored.length) dispatch({ type: 'hydrate', lines: stored });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // private mode / quota — the order still works in memory
    }
  }, [lines]);

  // Escape closes the drawer, and the page behind it must not scroll
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const add = useCallback((product: Product, quantity = 1) => {
    dispatch({ type: 'add', product, quantity });
    setLastAddedId(product.id);
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: 'setQuantity', productId, quantity });
  }, []);

  const remove = useCallback((productId: string) => {
    dispatch({ type: 'remove', productId });
  }, []);

  const clear = useCallback(() => dispatch({ type: 'clear' }), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // clear the "just added" flash after a moment
  useEffect(() => {
    if (!lastAddedId) return;
    const t = window.setTimeout(() => setLastAddedId(null), 1600);
    return () => window.clearTimeout(t);
  }, [lastAddedId]);

  const value = useMemo<OrderContextValue>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    return {
      lines,
      count,
      total,
      isOpen,
      lastAddedId,
      add,
      setQuantity,
      remove,
      clear,
      open,
      close,
    };
  }, [lines, isOpen, lastAddedId, add, setQuantity, remove, clear, open, close]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used inside <OrderProvider>');
  return ctx;
}