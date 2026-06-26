import React, { forwardRef } from 'react';
import { format } from "date-fns";

/**
 * PrintableReceipt — komponenta za tiskanje računa z FURS podatki.
 *
 * Uporablja se z react-to-print:
 *   const handlePrint = useReactToPrint({ content: () => receiptRef.current });
 *   <PrintableReceipt ref={receiptRef} order={order} invoice={invoice} outlet={outlet} />
 *
 * Vsebuje:
 *   - Glavo z imenom restavracije in davčno številko
 *   - Podatke o stranki in mizi
 *   - Postavke računa (artikli, količine, cene)
 *   - Seštevek z DDV postavkami
 *   - FURS podatke (ZOI, EOR, invoice number)
 *   - QR kodo za preverjanje računa (FURS)
 *   - Nogo s zahvalo
 *
 * Stil je optimiziran za termalni tiskalnik (58mm ali 80mm širina).
 */
const PrintableReceipt = forwardRef(({ order, invoice, outlet, settings }, ref) => {
    if (!order) return null;

    const restaurantName = outlet?.name || "Tasty Station";
    const restaurantAddress = outlet?.address ? `${outlet.address.street || ""}, ${outlet.address.city || ""}`.trim(", ") : "";
    const restaurantPhone = outlet?.phone || "";
    const taxNumber = invoice?.taxNumber || outlet?.taxNumber || "";
    const currency = settings?.symbol || "€";

    const items = order.items || [];
    const subtotal = invoice?.totals?.subtotal || order.totalAmount || 0;
    const taxAmount = invoice?.totals?.taxAmount || 0;
    const total = invoice?.totals?.total || order.totalAmount || 0;
    const taxBreakdown = invoice?.taxBreakdown || [];
    const zoi = invoice?.zoi;
    const eor = invoice?.eor;
    const fiscalQR = invoice?.fiscalQR;
    const invoiceNumber = invoice?.invoiceNumber;
    const issueDate = invoice?.issueDateTime || order.createdAt;

    const fmt = (amount) => {
        return `${(amount || 0).toFixed(2)} ${currency}`;
    };

    return (
        <div ref={ref} style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "11px",
            width: "280px",
            padding: "10px",
            color: "#000",
            background: "#fff",
            lineHeight: 1.4,
        }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "16px", fontWeight: "bold" }}>{restaurantName}</div>
                {restaurantAddress && <div style={{ fontSize: "10px" }}>{restaurantAddress}</div>}
                {restaurantPhone && <div style={{ fontSize: "10px" }}>Tel: {restaurantPhone}</div>}
                {taxNumber && <div style={{ fontSize: "10px" }}>Davčna št.: {taxNumber}</div>}
            </div>

            <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

            {/* Invoice info */}
            <div style={{ marginBottom: "5px" }}>
                {invoiceNumber && <div>Račun št.: <b>{invoiceNumber}</b></div>}
                <div>Datum: {format(new Date(issueDate), "dd.MM.yyyy HH:mm:ss")}</div>
                <div>Vrsta: {order.type === "Dine-in" ? "Restavracija" : "Za vzeti"}</div>
            </div>

            <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

            {/* Customer */}
            <div style={{ marginBottom: "5px" }}>
                <div>Stranka: {order.clientName || "Potrošnik"}</div>
                {order.clientPhone && <div>Telefon: {order.clientPhone}</div>}
                {order.table?.name && <div>Miza: {order.table.name}</div>}
            </div>

            <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

            {/* Items */}
            <div style={{ marginBottom: "5px" }}>
                <div style={{ display: "flex", fontWeight: "bold", fontSize: "10px" }}>
                    <span style={{ flex: 1 }}>Artikel</span>
                    <span style={{ width: "30px", textAlign: "center" }}>Kol</span>
                    <span style={{ width: "50px", textAlign: "right" }}>Cena</span>
                    <span style={{ width: "55px", textAlign: "right" }}>Skupaj</span>
                </div>
                {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", fontSize: "10px", margin: "2px 0" }}>
                        <span style={{ flex: 1 }}>{item.name}</span>
                        <span style={{ width: "30px", textAlign: "center" }}>{item.quantity}</span>
                        <span style={{ width: "50px", textAlign: "right" }}>{item.price.toFixed(2)}</span>
                        <span style={{ width: "55px", textAlign: "right" }}>{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                ))}
            </div>

            <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

            {/* Totals */}
            <div style={{ marginBottom: "5px", fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Vmesni seštevek:</span>
                    <span>{fmt(subtotal)}</span>
                </div>
                {taxBreakdown.length > 0 ? (
                    taxBreakdown.map((tb, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                            <span>DDV {tb.rate}%:</span>
                            <span>{fmt(tb.tax)}</span>
                        </div>
                    ))
                ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                        <span>DDV:</span>
                        <span>{fmt(taxAmount)}</span>
                    </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px", marginTop: "3px" }}>
                    <span>SKUPAJ:</span>
                    <span>{fmt(total)}</span>
                </div>
            </div>

            <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

            {/* Payment */}
            <div style={{ marginBottom: "5px", fontSize: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Plačilo:</span>
                    <span>{order.paymentMethod === "Cash" ? "Gotovina" : order.paymentMethod === "Card" ? "Kartica" : order.paymentMethod || "Gotovina"}</span>
                </div>
                {(order.amountPaid || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Plačano:</span>
                        <span>{fmt(order.amountPaid)}</span>
                    </div>
                )}
                {(order.balanceDue || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Preostane:</span>
                        <span>{fmt(order.balanceDue)}</span>
                    </div>
                )}
            </div>

            {/* FURS data */}
            {(zoi || eor) && (
                <>
                    <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />
                    <div style={{ fontSize: "8px", textAlign: "center", marginBottom: "5px" }}>
                        {zoi && (
                            <div style={{ wordBreak: "break-all", marginBottom: "3px" }}>
                                ZOI: {zoi}
                            </div>
                        )}
                        {eor && (
                            <div style={{ wordBreak: "break-all" }}>
                                EOR: {eor}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* QR code — prikažemo kot URL ki ga je mogoče skenirati */}
            {fiscalQR && (
                <div style={{ textAlign: "center", margin: "5px 0" }}>
                    <div style={{ fontSize: "8px", marginBottom: "2px" }}>Skeniraj za preverjanje:</div>
                    {/* V produkciji tukaj uporabi QRCode komponento ki generira sliko.
                          Za tekstovni termalni tiskalnik se QR koda natisne preko ESC/POS ukazov. */}
                    <div style={{ fontFamily: "monospace", fontSize: "7px", wordBreak: "break-all" }}>
                        {fiscalQR}
                    </div>
                </div>
            )}

            <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

            {/* Footer */}
            <div style={{ textAlign: "center", fontSize: "10px", marginTop: "5px" }}>
                <div style={{ fontWeight: "bold" }}>Hvala za obisk! 🙏</div>
                <div style={{ fontSize: "9px", marginTop: "2px" }}>Prosimo, pridite znova.</div>
                {outlet?.email && <div style={{ fontSize: "8px", marginTop: "3px" }}>{outlet.email}</div>}
            </div>

            {/* Cut line */}
            <div style={{ textAlign: "center", marginTop: "10px", fontSize: "10px" }}>
                - - - - - - - - - - - - - - -
            </div>
        </div>
    );
});

PrintableReceipt.displayName = "PrintableReceipt";

export default PrintableReceipt;
