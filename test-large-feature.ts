// ============================================================================
// LARGE FEATURE IMPLEMENTATION - E-COMMERCE SHOPPING CART SYSTEM
// This file contains over 1000 lines of code to test intelligent commit splitting
// ============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  brand: string;
  images: string[];
  variants: ProductVariant[];
  inventory: InventoryInfo;
  ratings: RatingInfo;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  originalPrice?: number;
  attributes: Record<string, string>;
  inventory: number;
  isActive: boolean;
}

interface InventoryInfo {
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  lowStockThreshold: number;
  backorderAllowed: boolean;
  maxOrderQuantity: number;
}

interface RatingInfo {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  recentReviews: Review[];
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  helpful: number;
  notHelpful: number;
  createdAt: Date;
  verified: boolean;
}

interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  addedAt: Date;
  updatedAt: Date;
  selectedAttributes: Record<string, string>;
}

interface ShoppingCart {
  id: string;
  userId?: string;
  sessionId: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: Date;
  addresses: Address[];
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

interface Address {
  id: string;
  type: 'billing' | 'shipping';
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

interface UserPreferences {
  currency: string;
  language: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  theme: 'light' | 'dark' | 'auto';
}

interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  billingAddress: Address;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
  shippingMethod: ShippingMethod;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  total: number;
  selectedAttributes: Record<string, string>;
}

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'paypal' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface ShippingMethod {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDays: string;
  isAvailable: boolean;
}

// ============================================================================
// API CLIENT CLASSES
// ============================================================================

class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(baseUrl: string, apiKey: string, timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

class ProductApiClient extends ApiClient {
  async getProducts(params: ProductSearchParams): Promise<ProductSearchResult> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.get<ProductSearchResult>(`/products?${queryString}`);
  }

  async getProduct(id: string): Promise<Product> {
    return this.get<Product>(`/products/${id}`);
  }

  async createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    return this.post<Product>('/products', product);
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    return this.patch<Product>(`/products/${id}`, updates);
  }

  async deleteProduct(id: string): Promise<void> {
    return this.delete<void>(`/products/${id}`);
  }

  async getProductReviews(productId: string, params: ReviewSearchParams): Promise<ReviewSearchResult> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.get<ReviewSearchResult>(`/products/${productId}/reviews?${queryString}`);
  }

  async addProductReview(productId: string, review: Omit<Review, 'id' | 'createdAt'>): Promise<Review> {
    return this.post<Review>(`/products/${productId}/reviews`, review);
  }
}

class CartApiClient extends ApiClient {
  async getCart(sessionId: string): Promise<ShoppingCart> {
    return this.get<ShoppingCart>(`/cart/${sessionId}`);
  }

  async addToCart(sessionId: string, item: Omit<CartItem, 'id' | 'addedAt' | 'updatedAt'>): Promise<ShoppingCart> {
    return this.post<ShoppingCart>(`/cart/${sessionId}/items`, item);
  }

  async updateCartItem(sessionId: string, itemId: string, updates: Partial<CartItem>): Promise<ShoppingCart> {
    return this.patch<ShoppingCart>(`/cart/${sessionId}/items/${itemId}`, updates);
  }

  async removeFromCart(sessionId: string, itemId: string): Promise<ShoppingCart> {
    return this.delete<ShoppingCart>(`/cart/${sessionId}/items/${itemId}`);
  }

  async clearCart(sessionId: string): Promise<ShoppingCart> {
    return this.delete<ShoppingCart>(`/cart/${sessionId}`);
  }

  async applyCoupon(sessionId: string, couponCode: string): Promise<ShoppingCart> {
    return this.post<ShoppingCart>(`/cart/${sessionId}/coupons`, { code: couponCode });
  }

  async removeCoupon(sessionId: string, couponCode: string): Promise<ShoppingCart> {
    return this.delete<ShoppingCart>(`/cart/${sessionId}/coupons/${couponCode}`);
  }
}

class OrderApiClient extends ApiClient {
  async createOrder(order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    return this.post<Order>('/orders', order);
  }

  async getOrder(id: string): Promise<Order> {
    return this.get<Order>(`/orders/${id}`);
  }

  async getUserOrders(userId: string, params: OrderSearchParams): Promise<OrderSearchResult> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.get<OrderSearchResult>(`/users/${userId}/orders?${queryString}`);
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    return this.patch<Order>(`/orders/${id}/status`, { status });
  }

  async cancelOrder(id: string, reason: string): Promise<Order> {
    return this.patch<Order>(`/orders/${id}/cancel`, { reason });
  }

  async requestRefund(id: string, reason: string, items?: string[]): Promise<Order> {
    return this.post<Order>(`/orders/${id}/refunds`, { reason, items });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const calculateDiscount = (originalPrice: number, currentPrice: number): number => {
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

const validatePostalCode = (postalCode: string, country: string): boolean => {
  const postalCodeRegex: Record<string, RegExp> = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$/,
    UK: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  };

  const regex = postalCodeRegex[country] || /^[\w\s\-]{3,10}$/;
  return regex.test(postalCode);
};

const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp.slice(-8)}-${random}`;
};

const calculateShippingCost = (
  items: CartItem[],
  shippingMethod: ShippingMethod,
  address: Address
): number => {
  let baseCost = shippingMethod.price;
  
  // Add weight-based surcharge
  const totalWeight = items.reduce((sum, item) => sum + (item.quantity * 0.5), 0);
  if (totalWeight > 10) {
    baseCost += (totalWeight - 10) * 2;
  }

  // Add distance-based surcharge for international shipping
  if (address.country !== 'US') {
    baseCost *= 1.5;
  }

  return Math.round(baseCost * 100) / 100;
};

const calculateTax = (
  items: CartItem[],
  address: Address,
  taxRates: Record<string, number>
): number => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxRate = taxRates[address.state] || 0;
  return Math.round(subtotal * taxRate * 100) / 100;
};

// ============================================================================
// HOOKS
// ============================================================================

export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
};

export const useSessionStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
};

export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit = {}
) => {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(callback, options);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [callback, options]);

  return observerRef.current;
};

export const useClickOutside = (ref: React.RefObject<HTMLElement>, handler: () => void) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

export const useKeyPress = (targetKey: string, callback: () => void) => {
  useEffect(() => {
    const downHandler = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        callback();
      }
    };

    window.addEventListener('keydown', downHandler);

    return () => {
      window.removeEventListener('keydown', downHandler);
    };
  }, [targetKey, callback]);
};

// ============================================================================
// CONTEXT PROVIDERS
// ============================================================================

interface CartContextType {
  cart: ShoppingCart | null;
  loading: boolean;
  error: string | null;
  addToCart: (product: Product, quantity: number, variant?: ProductVariant) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: (code: string) => Promise<void>;
}

const CartContext = React.createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<ShoppingCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useSessionStorage('cart-session-id', uuidv4());
  const cartApi = useMemo(() => new CartApiClient('/api', 'dummy-key'), []);

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const cartData = await cartApi.getCart(sessionId);
      setCart(cartData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  }, [cartApi, sessionId]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const addToCart = useCallback(async (product: Product, quantity: number, variant?: ProductVariant) => {
    try {
      setLoading(true);
      setError(null);
      
      const item: Omit<CartItem, 'id' | 'addedAt' | 'updatedAt'> = {
        productId: product.id,
        variantId: variant?.id,
        quantity,
        price: variant?.price || product.price,
        originalPrice: variant?.originalPrice || product.originalPrice,
        selectedAttributes: variant?.attributes || {},
      };

      const updatedCart = await cartApi.addToCart(sessionId, item);
      setCart(updatedCart);
      toast.success(`${product.name} added to cart`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item to cart');
      toast.error('Failed to add item to cart');
    } finally {
      setLoading(false);
    }
  }, [cartApi, sessionId]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedCart = await cartApi.updateCartItem(sessionId, itemId, { quantity });
      setCart(updatedCart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
      toast.error('Failed to update quantity');
    } finally {
      setLoading(false);
    }
  }, [cartApi, sessionId]);

  const removeFromCart = useCallback(async (itemId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedCart = await cartApi.removeFromCart(sessionId, itemId);
      setCart(updatedCart);
      toast.success('Item removed from cart');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
      toast.error('Failed to remove item');
    } finally {
      setLoading(false);
    }
  }, [cartApi, sessionId]);

  const clearCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedCart = await cartApi.clearCart(sessionId);
      setCart(updatedCart);
      toast.success('Cart cleared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cart');
      toast.error('Failed to clear cart');
    } finally {
      setLoading(false);
    }
  }, [cartApi, sessionId]);

  const applyCoupon = useCallback(async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedCart = await cartApi.applyCoupon(sessionId, code);
      setCart(updatedCart);
      toast.success('Coupon applied successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply coupon');
      toast.error('Failed to apply coupon');
    } finally {
      setLoading(false);
    }
  }, [cartApi, sessionId]);

  const removeCoupon = useCallback(async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedCart = await cartApi.removeCoupon(sessionId, code);
      setCart(updatedCart);
      toast.success('Coupon removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove coupon');
      toast.error('Failed to remove coupon');
    } finally {
      setLoading(false);
    }
  }, [cartApi, sessionId]);

  const value: CartContextType = {
    cart,
    loading,
    error,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextType => {
  const context = React.useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// ============================================================================
// COMPONENTS
// ============================================================================

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
  onViewDetails: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onViewDetails,
}) => {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const currentPrice = selectedVariant?.price || product.price;
  const originalPrice = selectedVariant?.originalPrice || product.originalPrice;
  const discount = originalPrice ? calculateDiscount(originalPrice, currentPrice) : 0;

  const handleAddToCart = async () => {
    setIsLoading(true);
    try {
      await onAddToCart(product, quantity, selectedVariant || undefined);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="product-card">
      <div className="product-image">
        <img src={product.images[0]} alt={product.name} />
        {discount > 0 && (
          <div className="discount-badge">
            -{discount}%
          </div>
        )}
      </div>
      
      <div className="product-info">
        <h3 className="product-name" onClick={() => onViewDetails(product)}>
          {product.name}
        </h3>
        
        <p className="product-brand">{product.brand}</p>
        
        <div className="product-price">
          <span className="current-price">{formatCurrency(currentPrice)}</span>
          {originalPrice && (
            <span className="original-price">{formatCurrency(originalPrice)}</span>
          )}
        </div>
        
        <div className="product-rating">
          <div className="stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`star ${star <= product.ratings.averageRating ? 'filled' : ''}`}
              >
                ★
              </span>
            ))}
          </div>
          <span className="rating-count">({product.ratings.totalReviews})</span>
        </div>
        
        {product.variants.length > 0 && (
          <div className="product-variants">
            <select
              value={selectedVariant?.id || ''}
              onChange={(e) => {
                const variant = product.variants.find(v => v.id === e.target.value);
                setSelectedVariant(variant || null);
              }}
            >
              <option value="">Select variant</option>
              {product.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="product-actions">
          <div className="quantity-selector">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              -
            </button>
            <span>{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              disabled={quantity >= (selectedVariant?.inventory || product.inventory.maxOrderQuantity)}
            >
              +
            </button>
          </div>
          
          <button
            className="add-to-cart-btn"
            onClick={handleAddToCart}
            disabled={isLoading || !selectedVariant}
          >
            {isLoading ? 'Adding...' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface CartItemProps {
  item: CartItem;
  product: Product;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

export const CartItemComponent: React.FC<CartItemProps> = ({
  item,
  product,
  onUpdateQuantity,
  onRemove,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity === item.quantity) return;
    
    setIsUpdating(true);
    try {
      await onUpdateQuantity(item.id, newQuantity);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async () => {
    setIsUpdating(true);
    try {
      await onRemove(item.id);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="cart-item">
      <div className="item-image">
        <img src={product.images[0]} alt={product.name} />
      </div>
      
      <div className="item-details">
        <h4 className="item-name">{product.name}</h4>
        
        {Object.keys(item.selectedAttributes).length > 0 && (
          <div className="item-variants">
            {Object.entries(item.selectedAttributes).map(([key, value]) => (
              <span key={key} className="variant-tag">
                {key}: {value}
              </span>
            ))}
          </div>
        )}
        
        <div className="item-price">
          <span className="current-price">{formatCurrency(item.price)}</span>
          {item.originalPrice && (
            <span className="original-price">{formatCurrency(item.originalPrice)}</span>
          )}
        </div>
      </div>
      
      <div className="item-quantity">
        <div className="quantity-selector">
          <button
            onClick={() => handleQuantityChange(item.quantity - 1)}
            disabled={isUpdating || item.quantity <= 1}
          >
            -
          </button>
          <span>{item.quantity}</span>
          <button
            onClick={() => handleQuantityChange(item.quantity + 1)}
            disabled={isUpdating || item.quantity >= product.inventory.maxOrderQuantity}
          >
            +
          </button>
        </div>
      </div>
      
      <div className="item-total">
        <span className="total-price">{formatCurrency(item.price * item.quantity)}</span>
      </div>
      
      <div className="item-actions">
        <button
          className="remove-btn"
          onClick={handleRemove}
          disabled={isUpdating}
        >
          Remove
        </button>
      </div>
    </div>
  );
};

interface ShoppingCartProps {
  onCheckout: () => void;
}

export const ShoppingCartComponent: React.FC<ShoppingCartProps> = ({ onCheckout }) => {
  const { cart, loading, error } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    setIsApplyingCoupon(true);
    try {
      await useCart().applyCoupon(couponCode.trim());
      setCouponCode('');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  if (loading) {
    return <div className="cart-loading">Loading cart...</div>;
  }

  if (error) {
    return <div className="cart-error">Error: {error}</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="empty-cart">
        <h3>Your cart is empty</h3>
        <p>Add some products to get started!</p>
      </div>
    );
  }

  return (
    <div className="shopping-cart">
      <h2>Shopping Cart</h2>
      
      <div className="cart-items">
        {cart.items.map((item) => (
          <CartItemComponent
            key={item.id}
            item={item}
            product={/* This would need to be fetched or passed down */}
            onUpdateQuantity={useCart().updateQuantity}
            onRemove={useCart().removeFromCart}
          />
        ))}
      </div>
      
      <div className="coupon-section">
        <input
          type="text"
          placeholder="Enter coupon code"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
        />
        <button
          onClick={handleApplyCoupon}
          disabled={isApplyingCoupon || !couponCode.trim()}
        >
          {isApplyingCoupon ? 'Applying...' : 'Apply'}
        </button>
      </div>
      
      <div className="cart-summary">
        <div className="summary-row">
          <span>Subtotal:</span>
          <span>{formatCurrency(cart.subtotal)}</span>
        </div>
        
        {cart.tax > 0 && (
          <div className="summary-row">
            <span>Tax:</span>
            <span>{formatCurrency(cart.tax)}</span>
          </div>
        )}
        
        {cart.shipping > 0 && (
          <div className="summary-row">
            <span>Shipping:</span>
            <span>{formatCurrency(cart.shipping)}</span>
          </div>
        )}
        
        {cart.discount > 0 && (
          <div className="summary-row discount">
            <span>Discount:</span>
            <span>-{formatCurrency(cart.discount)}</span>
          </div>
        )}
        
        <div className="summary-row total">
          <span>Total:</span>
          <span>{formatCurrency(cart.total)}</span>
        </div>
      </div>
      
      <div className="cart-actions">
        <button className="clear-cart-btn" onClick={useCart().clearCart}>
          Clear Cart
        </button>
        <button className="checkout-btn" onClick={onCheckout}>
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export const ECommerceApp: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'rating'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const productApi = useMemo(() => new ProductApiClient('/api', 'dummy-key'), []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: ProductSearchParams = {
        search: debouncedSearchTerm,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        sortBy,
        sortOrder,
        limit: 50,
        offset: 0,
      };
      
      const result = await productApi.getProducts(params);
      setProducts(result.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [productApi, debouncedSearchTerm, selectedCategory, sortBy, sortOrder]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAddToCart = useCallback(async (product: Product, quantity: number) => {
    // This would be handled by the cart context
    console.log('Adding to cart:', product.name, quantity);
  }, []);

  const handleViewDetails = useCallback((product: Product) => {
    // Navigate to product details page
    console.log('Viewing details for:', product.name);
  }, []);

  const handleCheckout = useCallback(() => {
    // Navigate to checkout page
    console.log('Proceeding to checkout');
  }, []);

  if (loading) {
    return <div className="app-loading">Loading products...</div>;
  }

  if (error) {
    return <div className="app-error">Error: {error}</div>;
  }

  return (
    <CartProvider>
      <div className="ecommerce-app">
        <header className="app-header">
          <h1>E-Commerce Store</h1>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <nav className="app-nav">
            <button onClick={() => setSelectedCategory('all')}>All</button>
            <button onClick={() => setSelectedCategory('electronics')}>Electronics</button>
            <button onClick={() => setSelectedCategory('clothing')}>Clothing</button>
            <button onClick={() => setSelectedCategory('books')}>Books</button>
          </nav>
        </header>
        
        <main className="app-main">
          <div className="products-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        </main>
        
        <aside className="cart-sidebar">
          <ShoppingCartComponent onCheckout={handleCheckout} />
        </aside>
      </div>
    </CartProvider>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default ECommerceApp;
export {
  Product,
  ProductVariant,
  CartItem,
  ShoppingCart,
  User,
  Order,
  ProductApiClient,
  CartApiClient,
  OrderApiClient,
  formatCurrency,
  formatDate,
  validateEmail,
  validatePhone,
  ProductCard,
  CartItemComponent,
  ShoppingCartComponent,
};
