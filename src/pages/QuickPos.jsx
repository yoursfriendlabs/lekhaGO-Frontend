import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Minus,
  Package2,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Notice from "../components/Notice.jsx";
import PaymentMethodFields from "../components/PaymentMethodFields.jsx";
import NoteTextarea from "../components/NoteTextarea.jsx";
import QuickPaymentButtons from "../components/QuickPaymentButtons.jsx";
import QuickPartySelector from "../components/QuickPartySelector.jsx";
import QuickActionSuccessDialog from "../components/QuickActionSuccessDialog.jsx";
import { Dialog } from "../components/ui/Dialog.tsx";
import MobileFormStepper from "../components/MobileFormStepper.jsx";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useBusinessSettings } from "../lib/businessSettings.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { useSnackbar } from "../lib/snackbar.jsx";
import { formatCurrency } from "../lib/currency";
import { todayISODate } from "../lib/datetime";
import { normalizeLookupProduct } from "../lib/lookups.js";
import { buildPaymentPayload, requiresBankSelection } from "../lib/payments";
import { getCurrentCreatorValue } from "../lib/records";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { useProductStore } from "../stores/products";

function getProductCategoryName(product = {}) {
  if (typeof product.categoryName === "string" && product.categoryName.trim())
    return product.categoryName.trim();
  if (
    product.category &&
    typeof product.category === "object" &&
    typeof product.category.name === "string" &&
    product.category.name.trim()
  ) {
    return product.category.name.trim();
  }
  if (typeof product.category === "string" && product.category.trim())
    return product.category.trim();
  if (typeof product.companyName === "string" && product.companyName.trim())
    return product.companyName.trim();
  return "";
}

function normalizePosProduct(raw = {}) {
  const product = normalizeLookupProduct(raw);

  return {
    ...raw,
    ...product,
    id: product.id || String(raw.id || ""),
    name: product.name || raw.name || "Item",
    categoryName: getProductCategoryName(raw),
    taxRate: Number(raw.taxRate ?? product.taxRate ?? 0),
  };
}

function getItemInitials(name = "") {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "IT";

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk[0] || "")
    .join("")
    .toUpperCase();
}

function getLineTaxAmount(item) {
  return (Number(item.lineTotal || 0) * Number(item.taxRate || 0)) / 100;
}

function formatStockLabel(product, unitType = "primary") {
  const stockOnHand = Number(product.stockOnHand || 0);
  const conversionRate = Number(product.conversionRate || 0);
  const isSecondary =
    unitType === "secondary" && product.secondaryUnit && conversionRate > 0;
  const quantity = (
    isSecondary ? stockOnHand * conversionRate : stockOnHand
  ).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const unit = isSecondary ? product.secondaryUnit : product.primaryUnit;

  return `${quantity} ${unit || ""}`.trim();
}

function getProductUnitLabel(product, unitType) {
  if (!product) return "";
  if (unitType === "secondary")
    return product.secondaryUnit || product.primaryUnit || "";
  return product.primaryUnit || product.secondaryUnit || "";
}

function deriveUnitPrice(product, unitType = "primary") {
  if (!product) return 0;
  if (unitType === "secondary") {
    const explicitSecondary = Number(product.secondarySalePrice || 0);
    if (explicitSecondary > 0) return explicitSecondary;
    const conversionRate = Number(product.conversionRate || 0);
    const primaryPrice = Number(product.salePrice || 0);
    if (conversionRate > 0 && primaryPrice > 0) {
      return Number((primaryPrice / conversionRate).toFixed(4));
    }
  }
  return Number(product.salePrice || product.sellingPrice || 0);
}

function buildCartItem(product, unitType = "primary") {
  const unitPrice = deriveUnitPrice(product, unitType);
  return {
    productId: product.id,
    name: product.name,
    categoryName: product.categoryName,
    quantity: 1,
    unitType,
    unitPrice,
    taxRate: Number(product.taxRate || 0),
    lineTotal: unitPrice.toFixed(2),
    primaryUnit: product.primaryUnit || "",
    secondaryUnit: product.secondaryUnit || "",
    conversionRate: Number(product.conversionRate || 0),
    secondarySalePrice: Number(product.secondarySalePrice || 0),
    salePrice: Number(product.salePrice || product.sellingPrice || 0),
    stockOnHand: Number(product.stockOnHand || 0),
  };
}

const emptyCheckoutForm = {
  saleDate: todayISODate(),
  invoiceNo: "",
  notes: "",
  discount: "0",
  amountReceived: "0",
  paymentMethod: "cash",
  bankId: "",
  paymentNote: "",
};

const MOBILE_PRODUCT_PAGE_SIZE = 9;
const MOBILE_PRODUCT_SCROLL_THRESHOLD = 120;

export default function QuickPos() {
  const { t } = useI18n();
  const { showError } = useSnackbar();
  const { businessId, user } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const navigate = useNavigate();
  const isMobile = useIsMobile("(max-width: 1023px)");
  const { invalidate: invalidateProducts } = useProductStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "info", message: "" });
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [partySelectorOpen, setPartySelectorOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState(emptyCheckoutForm);
  const [showAmountReceivedInput, setShowAmountReceivedInput] = useState(false);
  const [suggestedInvoiceNo, setSuggestedInvoiceNo] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successState, setSuccessState] = useState(null);
  const [mobileStep, setMobileStep] = useState("items");
  const [productUnitTypes, setProductUnitTypes] = useState({});
  const [visibleProductCount, setVisibleProductCount] = useState(
    MOBILE_PRODUCT_PAGE_SIZE,
  );
  const mobileProductScrollRef = useRef(null);
  const mobileProductLoadMoreRef = useRef(null);

  const formSteps = [
    { id: "items", label: t("Items") || "Items" },
    { id: "details", label: t("Checkout") || "Details" },
  ];

  const salesTitle =
    businessProfile?.type === "cafe"
      ? businessProfile?.salesFlow?.title || t("quickPos.title")
      : t("quickPos.title");

  const money = (value) =>
    formatCurrency(value, { symbol: t("currency.symbol") });

  const handleReviewBill = () => {
    if (!cart.length) {
      showError(t("sales.addFirstItem"));
      return;
    }

    if (isMobile) setMobileStep("details");
    else setCheckoutOpen(true);
  };

  useEffect(() => {
    if (!businessId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let isActive = true;
    setLoading(true);
    setStatus({ type: "info", message: "" });

    Promise.all([
      api.listProducts({ limit: 500 }),
      api.getNextSequences().catch(() => null),
    ])
      .then(([productResponse, sequenceResponse]) => {
        if (!isActive) return;
        const normalizedProducts = (productResponse?.items || [])
          .map(normalizePosProduct)
          .filter((product) => product.id);

        setProducts(normalizedProducts);
        setSuggestedInvoiceNo(sequenceResponse?.nextSaleInvoiceNo || "");
      })
      .catch((error) => {
        if (!isActive) return;
        setProducts([]);
        setStatus({ type: "error", message: error.message });
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [businessId]);

  const categoryOptions = useMemo(() => {
    const categories = [
      ...new Set(
        products.map((product) => product.categoryName).filter(Boolean),
      ),
    ];
    return ["all", ...categories];
  }, [products]);
  const quickCategoryOptions = useMemo(
    () => categoryOptions.slice(0, 3),
    [categoryOptions],
  );
  const productsById = useMemo(() => {
    const entries = products.map((product) => [String(product.id), product]);
    return Object.fromEntries(entries);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" || product.categoryName === selectedCategory;
      if (!matchesCategory) return false;
      if (!query) return true;

      const searchText = [
        product.name,
        product.companyName,
        product.categoryName,
        product.primaryUnit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(query);
    });
  }, [products, search, selectedCategory]);

  useEffect(() => {
    setVisibleProductCount(
      isMobile ? MOBILE_PRODUCT_PAGE_SIZE : filteredProducts.length,
    );

    if (isMobile) {
      mobileProductScrollRef.current?.scrollTo({ top: 0 });
    }
  }, [filteredProducts.length, isMobile, search, selectedCategory]);

  const visibleProducts = useMemo(
    () =>
      isMobile
        ? filteredProducts.slice(0, visibleProductCount)
        : filteredProducts,
    [filteredProducts, isMobile, visibleProductCount],
  );

  const hasMoreMobileProducts =
    isMobile && visibleProductCount < filteredProducts.length;

  const loadMoreMobileProducts = () => {
    setVisibleProductCount((previous) =>
      Math.min(previous + MOBILE_PRODUCT_PAGE_SIZE, filteredProducts.length),
    );
  };

  const handleMobileProductScroll = (event) => {
    if (!hasMoreMobileProducts) return;

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (
      scrollHeight - scrollTop - clientHeight <=
      MOBILE_PRODUCT_SCROLL_THRESHOLD
    ) {
      loadMoreMobileProducts();
    }
  };

  useEffect(() => {
    if (
      !hasMoreMobileProducts ||
      !mobileProductLoadMoreRef.current ||
      typeof IntersectionObserver === "undefined"
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreMobileProducts();
      },
      {
        root: mobileProductScrollRef.current,
        rootMargin: "96px",
      },
    );

    observer.observe(mobileProductLoadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredProducts.length, hasMoreMobileProducts, visibleProductCount]);

  const totals = useMemo(() => {
    const subTotal = cart.reduce(
      (sum, item) => sum + Number(item.lineTotal || 0),
      0,
    );
    const lineTaxTotal = cart.reduce(
      (sum, item) => sum + getLineTaxAmount(item),
      0,
    );
    const headerTaxRate = Number(checkoutForm.taxRate || 0);
    const headerTaxTotal =
      headerTaxRate > 0 ? (subTotal * headerTaxRate) / 100 : 0;
    const taxTotal = lineTaxTotal + headerTaxTotal;
    const discountTotal = Math.min(
      Math.max(Number(checkoutForm.discount || 0), 0),
      subTotal + taxTotal,
    );
    const grandTotal = Math.max(subTotal + taxTotal - discountTotal, 0);

    return { subTotal, taxTotal, discountTotal, grandTotal };
  }, [cart, checkoutForm.discount, checkoutForm.taxRate]);

  useEffect(() => {
    if (!isPaid) return;
    setCheckoutForm((previous) => ({
      ...previous,
      amountReceived: totals.grandTotal.toFixed(2),
    }));
  }, [isPaid, totals.grandTotal]);

  const receivedAmount = useMemo(
    () =>
      isPaid
        ? totals.grandTotal
        : Math.min(Number(checkoutForm.amountReceived || 0), totals.grandTotal),
    [checkoutForm.amountReceived, isPaid, totals.grandTotal],
  );
  const dueAmount = Math.max(totals.grandTotal - receivedAmount, 0);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart],
  );

  const goToNextMobileStep = () => {
    if (mobileStep === "items") setMobileStep("details");
  };

  const goToPreviousMobileStep = () => {
    if (mobileStep === "details") setMobileStep("items");
  };

  const getProductById = (productId) => productsById[String(productId)] || null;

  const addProductToCart = (product, unitType = "primary") => {
    if (!product?.id) return;

    setCart((previous) => {
      const existingIndex = previous.findIndex(
        (item) => item.productId === product.id,
      );

      const stockOnHand = Number(product.stockOnHand || 0);

      if (existingIndex >= 0) {
        const currentItem = previous[existingIndex];
        const currentQty = Number(currentItem.quantity || 0);
        const newQty = currentQty + 1;

        // Check stock availability
        if (newQty > stockOnHand) {
          showError(
            t("sales.insufficientStock") ||
            `Insufficient stock for ${product.name}. Available: ${stockOnHand}`
          );
          return previous;
        }

        return previous.map((item, index) => {
          if (index !== existingIndex) return item;
          return {
            ...item,
            quantity: newQty,
            lineTotal: Number(newQty * Number(item.unitPrice || 0)).toFixed(
              2,
            ),
          };
        });
      }

      // Check stock availability for new item
      if (1 > stockOnHand) {
        showError(
          t("sales.insufficientStock") ||
          `Insufficient stock for ${product.name}. Available: ${stockOnHand}`
        );
        return previous;
      }

      return [...previous, buildCartItem(product, unitType)];
    });
  };

  const updateCartQuantity = (productId, nextQuantity) => {
    if (!productId) return;

    const product = getProductById(productId);
    const stockOnHand = Number(product?.stockOnHand || 0);
    const requestedQty = Math.max(Number(nextQuantity || 0), 0);

    // Validate stock availability
    if (requestedQty > 0 && requestedQty > stockOnHand) {
      showError(
        t("sales.insufficientStock") ||
        `Insufficient stock for ${product?.name}. Available: ${stockOnHand}`
      );
      return;
    }

    setCart((previous) =>
      previous
        .map((item) => {
          if (item.productId !== productId) return item;
          const quantity = requestedQty;
          return {
            ...item,
            quantity,
            lineTotal: (quantity * Number(item.unitPrice || 0)).toFixed(2),
          };
        })
        .filter((item) => Number(item.quantity || 0) > 0),
    );
  };

  const updateCartPrice = (productId, nextPrice) => {
    if (!productId) return;

    setCart((previous) =>
      previous.map((item) => {
        if (item.productId !== productId) return item;
        const unitPrice = Math.max(Number(nextPrice || 0), 0);
        return {
          ...item,
          unitPrice,
          lineTotal: (Number(item.quantity || 0) * unitPrice).toFixed(2),
        };
      }),
    );
  };

  const updateCartUnitType = (productId, unitType) => {
    if (!productId) return;

    setCart((previous) =>
      previous.map((item) => {
        if (item.productId !== productId) return item;
        const product = getProductById(productId) || item;
        const unitPrice = deriveUnitPrice(product, unitType);
        return {
          ...item,
          unitType,
          unitPrice,
          conversionRate: Number(
            product.conversionRate || item.conversionRate || 0,
          ),
          secondarySalePrice: Number(
            product.secondarySalePrice || item.secondarySalePrice || 0,
          ),
          salePrice: Number(
            product.salePrice || item.salePrice || item.unitPrice || 0,
          ),
          primaryUnit: product.primaryUnit || item.primaryUnit || "",
          secondaryUnit: product.secondaryUnit || item.secondaryUnit || "",
          lineTotal: (Number(item.quantity || 0) * unitPrice).toFixed(2),
        };
      }),
    );
  };

  const resetSaleFlow = () => {
    setCart([]);
    setProductUnitTypes({});
    setSelectedParty(null);
    setCheckoutOpen(false);
    setCheckoutForm({
      ...emptyCheckoutForm,
      saleDate: todayISODate(),
      amountReceived: "0",
    });
    setIsPaid(true);
    setStatus({ type: "info", message: "" });
  };

  const handleSubmit = async (nextAction = "save") => {
    if (submitting) return;
    if (!businessId) {
      setStatus({ type: "error", message: t("errors.businessIdRequired") });
      return;
    }
    if (!cart.length) {
      setStatus({ type: "error", message: t("sales.addFirstItem") });
      return;
    }
    if (
      cart.some(
        (item) =>
          item.unitType === "secondary" &&
          Number(item.conversionRate || 0) <= 0,
      )
    ) {
      setStatus({ type: "error", message: t("errors.conversionRequired") });
      return;
    }

    // Validate stock availability before submission
    const insufficientStockItems = cart.filter((item) => {
      const product = getProductById(item.productId);
      const stock = Number(product?.stockOnHand || 0);
      return Number(item.quantity || 0) > stock;
    });

    if (insufficientStockItems.length > 0) {
      const itemNames = insufficientStockItems
        .map((item) => item.name)
        .join(", ");
      setStatus({
        type: "error",
        message: t("sales.insufficientStock") ||
          `Insufficient stock: ${itemNames}`,
      });
      return;
    }

    if (requiresBankSelection(checkoutForm, receivedAmount)) {
      setStatus({ type: "error", message: t("payments.bankRequired") });
      return;
    }

    try {
      setSubmitting(true);
      setStatus({ type: "info", message: "" });

      const manualInvoiceNo = String(checkoutForm.invoiceNo || "").trim();
      const { paymentMethod, bankId, paymentNote, discount, ...headerFields } =
        checkoutForm;
      const payload = {
        ...headerFields,
        status: dueAmount > 0 ? "due" : "paid",
        partyId: selectedParty?.id || null,
        amountReceived: receivedAmount,
        ...(Number(receivedAmount || 0) > 0
          ? buildPaymentPayload({ paymentMethod, bankId, paymentNote })
          : { paymentMethod: "cash" }),
        subTotal: totals.subTotal,
        taxTotal: totals.taxTotal,
        discount: totals.discountTotal,
        discountTotal: totals.discountTotal,
        grandTotal: totals.grandTotal,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          unitType: item.unitType || "primary",
          conversionRate: Number(
            item.conversionRate ||
              getProductById(item.productId)?.conversionRate ||
              0,
          ),
          unitPrice: Number(item.unitPrice || 0),
          taxRate: Number(item.taxRate || 0),
          lineTotal: Number(item.lineTotal || 0),
        })),
      };

      if (manualInvoiceNo) {
        payload.invoiceNo = manualInvoiceNo;
      } else {
        delete payload.invoiceNo;
      }

      const creatorValue = getCurrentCreatorValue(user);
      const created = await api.createSale(
        creatorValue ? { ...payload, createdBy: creatorValue } : payload,
      );
      const nextSequences = await api.getNextSequences().catch(() => null);

      invalidateProducts();
      setSuggestedInvoiceNo(nextSequences?.nextSaleInvoiceNo || "");
      setSuccessState({
        id: created?.id || "",
        invoiceNo: created?.invoiceNo || manualInvoiceNo || suggestedInvoiceNo,
        total: totals.grandTotal,
        action: nextAction,
      });
      resetSaleFlow();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const renderUnitOptionButtons = ({
    selectedUnitType,
    options,
    onChange,
    stopPropagation = false,
  }) => (
    <div
      className="inline-grid w-auto grid-cols-2 gap-0.5 rounded-full border border-slate-200 bg-white px-0.5 py-0.5 text-[9px] font-semibold shadow-sm sm:flex sm:flex-wrap sm:items-center sm:gap-0.5 sm:px-0.5"
      onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      onPointerDown={
        stopPropagation ? (event) => event.stopPropagation() : undefined
      }
      aria-label={t("products.unitType")}
    >
      {options.map((option) => {
        const isSelected = option.value === selectedUnitType;

        return (
          <button
            type="button"
            key={option.value}
            className={`min-w-0 rounded-full px-1 py-0.5 text-center text-[9px] transition sm:min-w-[3rem] ${
              isSelected
                ? "text-green-600"
                : "text-slate-500 hover:text-slate-800"
            } disabled:cursor-not-allowed disabled:text-slate-300`}
            onClick={() => onChange(option.value)}
            disabled={option.disabled}
          >
            {option.unit}
          </button>
        );
      })}
    </div>
  );

  const renderUnitSwitcher = (item) => {
    if (!item.secondaryUnit) {
      return (
        <span className="text-xs text-slate-500">
          /{" "}
          {getProductUnitLabel(item, item.unitType) || t("products.units.unit")}
        </span>
      );
    }

    const selectedUnitType = item.unitType || "primary";
    const options = [
      {
        value: "primary",
        unit: item.primaryUnit || t("products.primaryUnit"),
        disabled: false,
      },
      {
        value: "secondary",
        unit: item.secondaryUnit,
        disabled: Number(item.conversionRate || 0) <= 0,
      },
    ];

    return renderUnitOptionButtons({
      selectedUnitType,
      options,
      onChange: (nextUnitType) =>
        updateCartUnitType(item.productId, nextUnitType),
    });
  };

  const renderProductUnitSelect = (product, inCart) => {
    if (!product.secondaryUnit) return null;

    const selectedUnitType =
      inCart?.unitType || productUnitTypes[product.id] || "primary";
    const options = [
      {
        value: "primary",
        unit: product.primaryUnit || t("products.primaryUnit"),
        disabled: false,
      },
      {
        value: "secondary",
        unit: product.secondaryUnit,
        disabled: Number(product.conversionRate || 0) <= 0,
      },
    ];

    return renderUnitOptionButtons({
      selectedUnitType,
      options,
      stopPropagation: true,
      onChange: (nextUnitType) => {
        if (inCart) {
          updateCartUnitType(product.id, nextUnitType);
          return;
        }
        setProductUnitTypes((previous) => ({
          ...previous,
          [product.id]: nextUnitType,
        }));
      },
    });
  };

  const footerBar = (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-[24px] bg-slate-100 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"
              onClick={() => {
                if (isMobile && mobileStep === "items") {
                  setMobileStep("details");
                }
                setPartySelectorOpen(true);
              }}
            >
              <UserRound size={12} className="text-primary-600 shrink-0" />
              <span className="truncate">
                {selectedParty?.name || t("quickPos.walkInCustomer")}
              </span>
            </button>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {t("sales.grandTotal")}
            </p>
            <p className="text-lg font-bold text-slate-900">
              {money(totals.grandTotal)}
            </p>
          </div>
        </div>

        {isMobile && (
          <div className="flex flex-col gap-1 border-t border-slate-200/60 pt-2 text-[10px] font-medium text-slate-500">
            <div className="flex items-center justify-between">
              <span>
                {t("sales.subTotal")}: {money(totals.subTotal)}
              </span>
              {totals.taxTotal > 0 && (
                <span>
                  {t("tax")}: {money(totals.taxTotal)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/40 pt-1">
              <span>
                {t("services.amountReceived")}:{" "}
                <span className="text-slate-900 font-bold">
                  {money(receivedAmount)}
                </span>
              </span>
              <span>
                {t("services.dueAmount")}:{" "}
                <span
                  className={
                    dueAmount > 0
                      ? "text-rose-600 font-bold"
                      : "text-emerald-600 font-bold"
                  }
                >
                  {money(dueAmount)}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {isMobile && mobileStep === "details" ? (
          <>
            <button
              type="button"
              className="btn-secondary h-11 justify-center rounded-[18px] text-sm font-bold"
              onClick={() => setMobileStep("items")}
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              className="btn-primary h-11 justify-center rounded-[18px] text-sm font-bold"
              onClick={() => setCheckoutOpen(true)}
              disabled={!cart.length || submitting}
            >
              {t("CompleteSale") || "Complete"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn-secondary h-11 justify-center rounded-[18px] text-sm font-bold"
              onClick={handleReviewBill}
            >
              {isMobile ? t("Checkout") : t("quickPos.reviewBill")}
            </button>
            <button
              type="button"
              className="btn-primary h-11 justify-center rounded-[18px] text-sm font-bold"
              onClick={() => handleSubmit("save")}
              disabled={!cart.length || submitting}
            >
              {submitting ? t("common.saving") : t("quickPos.quickSave")}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-w-0 space-y-5 pb-28 md:pb-0">
      <PageHeader
        title={salesTitle}
        subtitle={isMobile ? "" : t("quickPos.subtitle")}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link className="btn-ghost h-11 justify-center rounded-[18px]" to="/app/sales">
              {t("quickPos.detailedSales")}
            </Link>
          </div>
        }
      />

      <div className="md:hidden">
        <MobileFormStepper
          steps={formSteps}
          currentStep={mobileStep}
          onStepChange={setMobileStep}
          onNext={goToNextMobileStep}
          onBack={goToPreviousMobileStep}
          canProceed={cart.length > 0}
          backLabel={t("common.back")}
          nextLabel={
            mobileStep === "items"
              ? t("quickPos.checkout")
              : t("common.continue")
          }
          showNavigation={false}
        />
      </div>

      {status.message ? (
        <Notice title={status.message} tone={status.type} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div
          className={`space-y-5 ${isMobile && mobileStep !== "items" ? "hidden" : ""}`}
        >
          <div className="rounded-[28px] border border-secondary-200/70 bg-white/90 p-3 shadow-sm sm:rounded-[32px]">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  className="input h-11 w-full rounded-[18px] bg-slate-50 pl-12 pr-4 text-sm focus:bg-white"
                  style={{ paddingLeft: "2.75rem", paddingRight: "1rem" }}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("quickPos.searchPlaceholder")}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full">
                <label className="sr-only" htmlFor="quick-pos-category">
                  {t("quickPos.allCategories")}
                </label>
                <select
                  id="quick-pos-category"
                  className="input h-11 w-full min-w-0 rounded-[18px] bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:bg-white sm:w-auto sm:min-w-[160px]"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category === "all"
                        ? t("quickPos.allCategories")
                        : category}
                    </option>
                  ))}
                </select>
                <Link
                  className="btn-secondary h-11 w-full justify-center rounded-[18px] text-xs sm:w-auto sm:flex-none sm:px-4"
                  to="/app/inventory"
                >
                  {t("quickPos.addNewItem")}
                </Link>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickCategoryOptions.map((category) => {
                const isActive = category === selectedCategory;
                const label =
                  category === "all" ? t("quickPos.allCategories") : category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`min-w-0 flex-1 truncate rounded-full px-3 py-2 text-xs font-semibold transition sm:flex-none ${
                      isActive
                        ? "bg-primary text-white shadow-md"
                        : "bg-white text-slate-600 border border-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="rounded-[32px] border border-dashed border-slate-200 bg-white/70 px-5 py-12 text-center text-slate-500">
              {t("common.loading")}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-slate-200 bg-white/70 px-5 py-12 text-center">
              <Package2 className="mx-auto text-slate-300" size={34} />
              <p className="mt-4 text-lg font-semibold text-slate-700">
                {t("quickPos.noProducts")}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {t("quickPos.noProductsHint")}
              </p>
            </div>
          ) : (
            <div
              ref={mobileProductScrollRef}
              className={
                isMobile
                  ? "max-h-[410px] overflow-y-auto pr-1 overscroll-contain"
                  : ""
              }
              onScroll={isMobile ? handleMobileProductScroll : undefined}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleProducts.map((product) => {
                  const inCart = cart.find(
                    (item) => item.productId === product.id,
                  );
                  const inCartQty = inCart
                    ? Number(inCart.quantity).toFixed(0)
                    : "0";
                  const selectedUnitType =
                    inCart?.unitType ||
                    productUnitTypes[product.id] ||
                    "primary";
                  const selectedUnitPrice = deriveUnitPrice(
                    product,
                    selectedUnitType,
                  );
                  const isOutOfStock = Number(product.stockOnHand || 0) <= 0;

                  return (
                    <article
                      key={product.id}
                      className={`flex flex-col overflow-hidden rounded-[24px] border bg-white shadow-sm transition-all hover:shadow-md ${
                        isOutOfStock
                          ? "opacity-75 bg-red-50 border-red-200"
                          : inCart
                            ? "border-primary ring-1 ring-primary-500 shadow-sm"
                            : "border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex flex-1 flex-col p-2.5">
<div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-xs font-bold text-slate-900 ${isOutOfStock ? "text-red-900" : ""}`}
                            >
                              {product.name}
                            </p>
                            <p
                              className={`mt-0.5 truncate text-[12px] text-slate-500 ${isOutOfStock ? "text-red-600" : ""}`}
                            >
                              {product.categoryName ||
                                product.companyName ||
                                t("common.general")}
                            </p>
                          </div>
                          <div className="shrink-0 w-full max-w-full sm:w-auto">
                            {renderProductUnitSelect(product, inCart)}
                          </div>
                        </div>

                        <div className="mt-auto pt-2">
                          <div className="flex items-end justify-between gap-1">
                            <p
                              className={`text-xs font-bold ${isOutOfStock ? "text-red-700" : "text-primary-700"}`}
                            >
                              {money(
                                inCart?.unitPrice ||
                                  selectedUnitPrice ||
                                  product.sellingPrice ||
                                  product.salePrice ||
                                  0,
                              )}
                            </p>
                            <p
                              className={`text-[11px] font-medium ${isOutOfStock ? "text-red-400" : "text-slate-400"}`}
                            >
                              {formatStockLabel(product, selectedUnitType)}
                            </p>
                          </div>

                          <div className="mt-2 flex">
                            {isOutOfStock ? (
                              <div className="w-full text-center py-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wider">
                                {t("products.outOfStock") || "Out of Stock"}
                              </div>
                            ) : Number(inCartQty) > 0 ? (
                              <div className="flex w-full items-center justify-between rounded-full bg-primary-50 px-1 py-1">
                                <button
                                  type="button"
                                  className="rounded-full bg-white p-1 text-primary shadow-sm"
                                  onClick={() =>
                                    updateCartQuantity(
                                      product.id,
                                      Number(inCartQty) - 1,
                                    )
                                  }
                                >
                                  <Minus size={12} />
                                </button>
                                <div className="flex items-center gap-0.5 min-w-0 flex-1 px-1">
                                  <input
                                    className="w-full border-0 bg-transparent p-0 text-center text-xs font-bold text-primary-900 focus:outline-none focus:ring-0"
                                    type="number"
                                    inputMode="decimal"
                                    value={inCartQty}
                                    onChange={(e) =>
                                      updateCartQuantity(
                                        product.id,
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="rounded-full bg-primary p-1 text-white shadow-sm"
                                  onClick={() =>
                                    updateCartQuantity(
                                      product.id,
                                      Number(inCartQty) + 1,
                                    )
                                  }
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn-ghost w-full justify-center rounded-full py-1.5 text-xs"
                                onClick={() =>
                                  addProductToCart(product, selectedUnitType)
                                }
                              >
                                {t("common.add")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {hasMoreMobileProducts ? (
                <div
                  ref={mobileProductLoadMoreRef}
                  className="h-8"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          )}
        </div>

        {/* --- Mobile Details Step --- */}
        {isMobile && mobileStep === "details" && (
          <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-secondary-200/70 bg-white/95 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("quickPos.currentBill")}
                </p>
                <button
                  type="button"
                  className="btn-ghost h-8 shrink-0 rounded-full px-2.5 text-[11px]"
                  onClick={() => setPartySelectorOpen(true)}
                >
                  {selectedParty
                    ? t("common.change")
                    : t("quickPos.selectParty")}
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <UserRound size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {selectedParty?.name || t("quickPos.walkInCustomer")}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {selectedParty?.phone || t("quickPos.walkInHint")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2.5">
                {cart.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <ShoppingBag className="mx-auto text-slate-300" size={28} />
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      {t("quickPos.emptyCart")}
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.productId}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-xs text-slate-500">
                              {t("currency.symbol")}
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              className="w-20 border-0 bg-transparent p-0 text-xs font-medium text-slate-600 focus:outline-none focus:ring-0"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateCartPrice(item.productId, e.target.value)
                              }
                            />
                            {renderUnitSwitcher(item)}
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-primary-700">
                          {money(item.lineTotal)}
                        </p>
                      </div>
                      <div className="mt-2.5 flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-white px-2 py-1">
                        <div className="flex items-center gap-1 rounded-full border border-primary-100 bg-white px-1">
                          <button
                            type="button"
                            className="rounded-full bg-slate-100 p-2 text-slate-600"
                            onClick={() =>
                              updateCartQuantity(
                                item.productId,
                                Number(item.quantity) - 1,
                              )
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <div className="flex min-w-0 items-center justify-center gap-1 px-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              className="w-12 border-0 bg-transparent p-0 text-center text-sm font-semibold text-slate-900 focus:outline-none focus:ring-0"
                              value={item.quantity}
                              onChange={(e) =>
                                updateCartQuantity(item.productId, e.target.value)
                              }
                            />
                            <span className="min-w-0 truncate text-xs text-slate-500">
                              {getProductUnitLabel(item, item.unitType)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="rounded-full bg-primary p-2 text-white"
                            onClick={() =>
                              updateCartQuantity(
                                item.productId,
                                Number(item.quantity) + 1,
                              )
                            }
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-rose-100 bg-white p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => updateCartQuantity(item.productId, 0)}
                          aria-label={t("common.delete")}
                          title={t("common.delete")}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 min-w-0 space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
                  <span className="min-w-0">{t("sales.subTotal")}</span>
                  <span className="shrink-0 text-right">{money(totals.subTotal)}</span>
                </div>

                <label className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(6.5rem,8rem)] items-center gap-2 text-sm text-slate-500">
                  <span className="min-w-0">
                    <span className="block">{t("tax") || "VAT"}</span>
                    <span className="block truncate text-[11px] font-semibold text-primary-700">
                      {Number(checkoutForm.taxRate || 0) > 0
                        ? money(totals.taxTotal)
                        : `+ ${t("sales.addTax")}`}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <div className="relative">
                      <input
                        className="input h-8 w-full rounded-lg border-primary/20 pr-9 text-right text-xs font-bold focus:border-primary focus:ring-primary/10"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={checkoutForm.taxRate || ""}
                        onChange={(event) =>
                          setCheckoutForm((previous) => ({
                            ...previous,
                            taxRate: event.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        %
                      </div>
                    </div>
                  </div>
                </label>

                <label className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(6.5rem,8rem)] items-center gap-2 text-sm text-slate-500">
                  <span className="min-w-0">
                    <span className="block">{t("quickPos.discount")}</span>
                    <span className="block truncate text-[11px] font-semibold text-primary-700">
                      {Number(checkoutForm.discount || 0) > 0
                        ? `- ${money(totals.discountTotal)}`
                        : `+ ${t("sales.addDiscount")}`}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <div className="relative">
                      <input
                        className="input h-8 w-full rounded-lg border-primary/20 pr-10 text-right text-xs font-bold focus:border-primary focus:ring-primary/10"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={checkoutForm.discount}
                        onChange={(event) =>
                          setCheckoutForm((previous) => ({
                            ...previous,
                            discount: event.target.value,
                          }))
                        }
                        placeholder="0.00"
                      />
                      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        {t("currency.symbol")}
                      </div>
                    </div>
                  </div>
                </label>

                {selectedParty && (
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(6.5rem,8rem)] items-center gap-2 text-sm text-slate-500">
                    <span className="min-w-0 truncate">{t("services.amountReceived")}</span>
                    {showAmountReceivedInput && !isPaid ? (
                      <div className="min-w-0">
                        <div className="relative">
                          <input
                            autoFocus
                            className="input h-8 rounded-lg pr-10 text-right font-bold w-full border-primary/20 focus:border-primary focus:ring-primary/10 text-xs"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={checkoutForm.amountReceived}
                            onChange={(event) =>
                              setCheckoutForm((previous) => ({
                                ...previous,
                                amountReceived: event.target.value,
                              }))
                            }
                            onBlur={() => setShowAmountReceivedInput(false)}
                          />
                          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                            {t("currency.symbol")}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            if (isPaid) setIsPaid(false);
                            setShowAmountReceivedInput(true);
                          }}
                          className="min-w-0 truncate text-right font-medium transition-colors hover:text-primary-600"
                        >
                          {isPaid
                            ? money(totals.grandTotal)
                            : Number(checkoutForm.amountReceived || 0) > 0
                              ? money(checkoutForm.amountReceived)
                              : `+ ${t("sales.addReceived")}`}
                        </button>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded accent-primary-600 cursor-pointer"
                          checked={isPaid}
                          onChange={(e) => setIsPaid(e.target.checked)}
                          title={t("quickPos.fullyPaid")}
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedParty && dueAmount > 0 && (
                  <div className="flex items-center justify-between gap-2 text-sm font-semibold text-amber-600">
                    <span className="min-w-0">{t("sales.dueAmount")}</span>
                    <span className="shrink-0 text-right">{money(dueAmount)}</span>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-base font-bold text-slate-900">
                  <span className="min-w-0">{t("sales.grandTotal")}</span>
                  <span className="shrink-0 text-right">{money(totals.grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-[28px] border border-secondary-200/70 bg-white/90 p-4 shadow-sm">
              <PaymentMethodFields
                value={checkoutForm}
                onChange={(patch) =>
                  setCheckoutForm((previous) => ({ ...previous, ...patch }))
                }
              />
            </div>
          </div>
        )}

        <aside className="hidden xl:block">
          <div className="sticky top-6 rounded-[32px] border border-secondary-200/70 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t("quickPos.currentBill")}
                </p>
                <h3 className="mt-2 font-serif text-2xl text-slate-900">
                  {suggestedInvoiceNo || t("quickPos.draftBill")}
                </h3>
              </div>
              <button
                type="button"
                className="btn-ghost rounded-full px-3"
                onClick={() => setPartySelectorOpen(true)}
              >
                {selectedParty ? t("common.change") : t("quickPos.selectParty")}
              </button>
            </div>

            {/* <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
                  <UserRound size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{selectedParty?.name || t('quickPos.walkInCustomer')}</p>
                  <p className="mt-1 text-sm text-slate-500">{selectedParty?.phone || t('quickPos.walkInHint')}</p>
                </div>
              </div>
            </div> */}

            <div className="mt-5 max-h-[340px] space-y-3 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <ShoppingBag className="mx-auto text-slate-300" size={28} />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {t("quickPos.emptyCart")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("quickPos.emptyCartHint")}
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-xs text-slate-500">
                            {t("currency.symbol")}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            className="w-20 border-0 bg-transparent p-0 text-xs font-medium text-slate-600 focus:outline-none focus:ring-0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateCartPrice(item.productId, e.target.value)
                            }
                          />
                          {renderUnitSwitcher(item)}
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-primary-700">
                        {money(item.lineTotal)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[18px] bg-white px-3 py-1">
                      <div className="flex items-center gap-2 rounded-full border border-primary-100 bg-white px-1">
                        <button
                          type="button"
                          className="rounded-full bg-slate-100 p-2 text-slate-600"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              Number(item.quantity) - 1,
                            )
                          }
                        >
                          <Minus size={14} />
                        </button>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            className="w-12 border-0 bg-transparent p-0 text-center text-sm font-semibold text-slate-900 focus:outline-none focus:ring-0"
                            value={item.quantity}
                            onChange={(e) =>
                              updateCartQuantity(item.productId, e.target.value)
                            }
                          />
                          <span className="text-xs text-slate-500">
                            {getProductUnitLabel(item, item.unitType)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="rounded-full bg-primary p-2 text-white"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              Number(item.quantity) + 1,
                            )
                          }
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-rose-100 bg-white p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => updateCartQuantity(item.productId, 0)}
                        aria-label={t("common.delete")}
                        title={t("common.delete")}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{t("sales.subTotal")}</span>
                <span>{money(totals.subTotal)}</span>
              </div>

              <label className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span className="min-w-0 max-w-full">
                  <span className="block">{t("Tax") || "VAT"}</span>
                  <span className="block text-[11px] font-semibold text-primary-700">
                    {Number(checkoutForm.taxRate || 0) > 0
                      ? money(totals.taxTotal)
                      : `+ ${t("sales.addTax")}`}
                  </span>
                </span>
                <div className="min-w-[7rem] w-full max-w-[8rem] shrink-0 sm:w-auto">
                  <div className="relative">
                    <input
                      className="input h-8 w-full rounded-lg border-primary/20 pr-9 text-right text-xs font-bold focus:border-primary focus:ring-primary/10"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={checkoutForm.taxRate || ""}
                      onChange={(event) =>
                        setCheckoutForm((previous) => ({
                          ...previous,
                          taxRate: event.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                      %
                    </div>
                  </div>
                </div>
              </label>

              <label className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span className="min-w-0 max-w-full">
                  <span className="block">{t("quickPos.discount")}</span>
                  <span className="block text-[11px] font-semibold text-primary-700">
                    {Number(checkoutForm.discount || 0) > 0
                      ? `- ${money(totals.discountTotal)}`
                      : `+ ${t("sales.addDiscount")}`}
                  </span>
                </span>
                <div className="min-w-[7rem] w-full max-w-[8rem] shrink-0 sm:w-auto">
                  <div className="relative">
                    <input
                      className="input h-8 w-full rounded-lg border-primary/20 pr-10 text-right text-xs font-bold focus:border-primary focus:ring-primary/10"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={checkoutForm.discount}
                      onChange={(event) =>
                        setCheckoutForm((previous) => ({
                          ...previous,
                          discount: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                      {t("currency.symbol")}
                    </div>
                  </div>
                </div>
              </label>

              {selectedParty && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                  <span>{t("services.amountReceived")}</span>
                  {showAmountReceivedInput && !isPaid ? (
                    <div className="min-w-[7rem] w-full max-w-[8rem] shrink-0 sm:w-auto">
                      <div className="relative">
                        <input
                          autoFocus
                          className="input h-8 rounded-lg pr-10 text-right font-bold w-full border-primary/20 focus:border-primary focus:ring-primary/10 text-xs"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={checkoutForm.amountReceived}
                          onChange={(event) =>
                            setCheckoutForm((previous) => ({
                              ...previous,
                              amountReceived: event.target.value,
                            }))
                          }
                          onBlur={() => setShowAmountReceivedInput(false)}
                        />
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          {t("currency.symbol")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isPaid) setIsPaid(false);
                          setShowAmountReceivedInput(true);
                        }}
                        className="hover:text-primary-600 transition-colors font-medium"
                      >
                        {isPaid
                          ? money(totals.grandTotal)
                          : Number(checkoutForm.amountReceived || 0) > 0
                            ? money(checkoutForm.amountReceived)
                            : `+ ${t("sales.addReceived")}`}
                      </button>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded accent-primary-600 cursor-pointer"
                        checked={isPaid}
                        onChange={(e) => setIsPaid(e.target.checked)}
                        title={t("quickPos.fullyPaid")}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedParty && dueAmount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-amber-600">
                  <span>{t("sales.dueAmount")}</span>
                  <span>{money(dueAmount)}</span>
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-lg font-bold text-slate-900">
                <span>{t("sales.grandTotal")}</span>
                <span>{money(totals.grandTotal)}</span>
              </div>
            </div>

            <div className="mt-5">{footerBar}</div>
          </div>
        </aside>
      </div>

      {isMobile ? (
        <div className="mobile-sticky-actions xl:hidden">{footerBar}</div>
      ) : null}

      <Dialog
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title={t("quickPos.confirmSale")}
        size="full"
        footer={
          <div className="flex w-full flex-col gap-3 md:flex-row">
            <button
              type="button"
              className="btn-secondary w-full justify-center rounded-[22px] md:w-auto md:flex-1"
              onClick={() => handleSubmit("print")}
              disabled={!cart.length || submitting}
            >
              {t("quickPos.saveAndPrint")}
            </button>
            <button
              type="button"
              className="btn-primary w-full justify-center rounded-[22px] md:w-auto md:flex-1"
              onClick={() => handleSubmit("save")}
              disabled={!cart.length || submitting}
            >
              {submitting ? t("common.saving") : t("quickPos.saveOnly")}
            </button>
          </div>
        }
      >
        <div className="space-y-3 overflow-x-hidden">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 transition focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-200">
              <span className="text-xs font-medium uppercase text-slate-500">
                {t("quickPos.invoiceNumber")}
              </span>
              <input
                className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                value={checkoutForm.invoiceNo}
                onChange={(event) =>
                  setCheckoutForm((previous) => ({
                    ...previous,
                    invoiceNo: event.target.value,
                  }))
                }
                placeholder={suggestedInvoiceNo || t("quickPos.autoInvoice")}
              />
            </label>

            <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 transition focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-200">
              <span className="text-xs font-medium uppercase text-slate-500">
                {t("common.date")}
              </span>
              <input
                className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-0"
                type="date"
                value={checkoutForm.saleDate}
                onChange={(event) =>
                  setCheckoutForm((previous) => ({
                    ...previous,
                    saleDate: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <UserRound size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {selectedParty?.name || t("quickPos.walkInCustomer")}
                  </p>
                  {selectedParty?.phone && (
                    <p className="truncate text-xs text-slate-500">
                      {selectedParty.phone}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost rounded-md px-2 text-xs font-semibold"
                onClick={() => setPartySelectorOpen(true)}
              >
                {selectedParty ? t("common.change") : t("quickPos.selectParty")}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-slate-600">
                {t("quickPos.billingItems", { count: cart.length })}
              </p>
              <button
                type="button"
                className="btn-ghost rounded-md px-2 text-xs"
                onClick={() => setCheckoutOpen(false)}
              >
                {t("quickPos.addItems")}
              </button>
            </div>

            <div className="mt-2 space-y-1.5 max-h-[180px] overflow-y-auto overflow-x-hidden">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{item.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-slate-600">
                        <span>{t("currency.symbol")}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-16 border-0 bg-transparent p-0 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateCartPrice(item.productId, e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1">
                        <button
                          type="button"
                          className="p-0.5 text-slate-600 hover:text-slate-900"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              Number(item.quantity) - 1,
                            )
                          }
                        >
                          <Minus size={10} />
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-8 border-0 bg-transparent p-0 text-center text-xs font-semibold text-slate-900 focus:outline-none focus:ring-0"
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartQuantity(item.productId, e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="p-0.5 text-primary hover:text-primary-700"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              Number(item.quantity) + 1,
                            )
                          }
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="p-0.5 text-rose-500 hover:text-rose-600"
                        onClick={() => updateCartQuantity(item.productId, 0)}
                        title={t("common.delete")}
                      >
                        <X size={10} />
                      </button>
                      <span className="font-bold text-primary-700">{money(item.lineTotal)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-200/40 bg-gradient-to-br from-amber-50/60 to-yellow-50/40 px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                      {t("quickPos.discount")}
                    </p>
                    <p className="text-lg font-bold text-amber-700">
                      {Number(checkoutForm.discount || 0) > 0
                        ? `- ${money(totals.discountTotal)}`
                        : t("sales.addDiscount")}
                    </p>
                  </div>
                  <div className="relative flex-1 max-w-[130px] flex justify-end">
                    <div className="relative w-full">
                      <input
                        className="input h-10 w-full rounded-xl border-amber-300/30 bg-white/80 pr-8 text-right font-semibold text-sm focus:border-amber-400 focus:ring-amber-100/50"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={checkoutForm.discount}
                        onChange={(event) =>
                          setCheckoutForm((previous) => ({
                            ...previous,
                            discount: event.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">
                        {t("currency.symbol")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200/40 bg-gradient-to-br from-blue-50/60 to-cyan-50/40 px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                      {t("tax") || "VAT"}
                    </p>
                    <p className="text-lg font-bold text-blue-700">
                      {Number(checkoutForm.taxRate || 0) > 0
                        ? money(totals.taxTotal)
                        : t("sales.addTax")}
                    </p>
                  </div>
                  <div className="relative flex-1 max-w-[130px] flex justify-end">
                    <div className="relative w-full">
                      <input
                        className="input h-10 w-full rounded-xl border-blue-300/30 bg-white/80 pr-8 text-right font-semibold text-sm focus:border-blue-400 focus:ring-blue-100/50"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={checkoutForm.taxRate || ""}
                        onChange={(event) =>
                          setCheckoutForm((previous) => ({
                            ...previous,
                            taxRate: event.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">
                        %
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {t("common.notes")}
                </p>
                <NoteTextarea
                  className="input mt-2.5 min-h-[80px] resize-none rounded-xl text-sm border-slate-200 focus:border-primary focus:ring-primary/10"
                  value={checkoutForm.notes}
                  onChange={(event) =>
                    setCheckoutForm((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                  placeholder={t("quickPos.notesPlaceholder")}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{t("sales.subTotal")}</span>
                    <span className="font-semibold text-slate-900">{money(totals.subTotal)}</span>
                  </div>
                  {totals.taxTotal > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{t("sales.taxTotal")}</span>
                      <span className="font-semibold text-slate-900">{money(totals.taxTotal)}</span>
                    </div>
                  )}
                  {totals.discountTotal > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{t("quickPos.discount")}</span>
                      <span className="font-semibold text-slate-900">- {money(totals.discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                    <span>{t("sales.grandTotal")}</span>
                    <span>{money(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {selectedParty && (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-600">
                        {t("services.amountReceived")}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isPaid) setShowAmountReceivedInput(true);
                          else setIsPaid(false);
                        }}
                        className={`text-sm font-bold transition-colors mt-1 ${isPaid ? "text-slate-400" : "text-primary-700"}`}
                      >
                        {isPaid
                          ? money(totals.grandTotal)
                          : Number(checkoutForm.amountReceived || 0) > 0
                            ? money(checkoutForm.amountReceived)
                            : `+ ${t("sales.addReceived")}`}
                      </button>
                    </div>
                    <label className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition shrink-0">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded accent-primary-600"
                        checked={isPaid}
                        onChange={(event) => {
                          setIsPaid(event.target.checked);
                          if (event.target.checked)
                            setShowAmountReceivedInput(false);
                        }}
                      />
                      {t("quickPos.fullyPaid")}
                    </label>
                  </div>

                  {showAmountReceivedInput && !isPaid && (
                    <div className="mt-3 relative w-full">
                      <input
                        autoFocus
                        className="input h-9 rounded-lg text-sm font-bold pr-8 w-full border-slate-200 focus:border-primary focus:ring-primary/10"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={checkoutForm.amountReceived}
                        onChange={(event) =>
                          setCheckoutForm((previous) => ({
                            ...previous,
                            amountReceived: event.target.value,
                          }))
                        }
                        onBlur={() => setShowAmountReceivedInput(false)}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                        {t("currency.symbol")}
                      </div>
                    </div>
                  )}

                  <div
                    className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold flex justify-between items-center ${
                      dueAmount > 0
                        ? "border border-amber-100 bg-amber-50 text-amber-700"
                        : "border border-emerald-100 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    <span>{t("sales.dueAmount")}</span>
                    <span>{money(dueAmount)}</span>
                  </div>
                </div>
              )}

              <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 min-w-0">
                <PaymentMethodFields
                  value={checkoutForm}
                  onChange={(patch) =>
                    setCheckoutForm((previous) => ({ ...previous, ...patch }))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      <QuickPartySelector
        isOpen={partySelectorOpen}
        onClose={() => setPartySelectorOpen(false)}
        onSelect={setSelectedParty}
        selectedParty={selectedParty}
        type="customer"
        includeWalkIn
        walkInLabel={t("quickPos.walkInCustomer")}
        walkInDescription={t("quickPos.walkInHint")}
        title={t("quickPos.selectPartyTitle")}
      />

      <QuickActionSuccessDialog
        isOpen={Boolean(successState)}
        onClose={() => setSuccessState(null)}
        closeLabel={t("common.close")}
        title={t("quickPos.saleRecorded")}
        description={
          successState
            ? t("quickPos.saleRecordedDescription", {
                invoice: successState.invoiceNo || t("quickPos.draftBill"),
                amount: money(successState.total),
              })
            : ""
        }
        primaryAction={
          successState?.id ? (
            <button
              type="button"
              className="btn-primary h-14 w-full justify-center rounded-[22px] text-base"
              onClick={() => {
                const target =
                  successState.action === "print"
                    ? `/app/invoice/sales/${successState.id}?print=1`
                    : `/app/invoice/sales/${successState.id}`;
                setSuccessState(null);
                navigate(target);
              }}
            >
              {successState?.action === "print"
                ? t("quickPos.openPrintPreview")
                : t("quickPos.viewInvoice")}
            </button>
          ) : null
        }
        secondaryAction={
          <button
            type="button"
            className="btn-ghost h-14 w-full justify-center rounded-[22px] text-base"
            onClick={() => setSuccessState(null)}
          >
            {t("quickPos.newSale")}
          </button>
        }
      />
    </div>
  );
}
