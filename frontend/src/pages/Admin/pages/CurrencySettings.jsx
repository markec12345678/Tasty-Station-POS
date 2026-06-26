import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Coins, Save, RotateCcw, CheckCircle2, DollarSign
} from 'lucide-react';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const CurrencySettings = () => {
    const { settings, presets, isLoading, getSettings, updateSettings, applyPreset } = useCurrencyStore();

    const [formData, setFormData] = useState({
        code: "EUR", symbol: "€", symbolPosition: "after", decimals: 2,
        locale: "sl-SI", thousandsSeparator: ".", decimalSeparator: ",",
        taxInclusive: true,
        taxRates: { standard: 22, reduced: 9.5, specialReduced: 5 }
    });

    useEffect(() => {
        getSettings();
    }, [getSettings]);

    useEffect(() => {
        if (settings) {
            setFormData({
                code: settings.code || "EUR",
                symbol: settings.symbol || "€",
                symbolPosition: settings.symbolPosition || "after",
                decimals: settings.decimals ?? 2,
                locale: settings.locale || "sl-SI",
                thousandsSeparator: settings.thousandsSeparator || ".",
                decimalSeparator: settings.decimalSeparator || ",",
                taxInclusive: settings.taxInclusive ?? true,
                taxRates: settings.taxRates || { standard: 22, reduced: 9.5, specialReduced: 5 }
            });
        }
    }, [settings]);

    const handleSave = async () => {
        await updateSettings(formData);
    };

    const handleApplyPreset = async (code) => {
        await applyPreset(code);
    };

    // Live preview
    const previewAmount = 1234.56;
    const previewFormatted = (() => {
        const fixed = previewAmount.toFixed(formData.decimals);
        const [intPart, decPart] = fixed.split(".");
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, formData.thousandsSeparator);
        const formatted = decPart
            ? `${formattedInt}${formData.decimalSeparator}${decPart}`
            : formattedInt;
        return formData.symbolPosition === "before"
            ? `${formData.symbol}${formatted}`
            : `${formatted} ${formData.symbol}`;
    })();

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Coins className="size-7 text-primary" />
                        Currency Settings
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Nastavi valuto, simbol, decimalke in davčne stopnje
                    </p>
                </div>

                {/* Current currency preview */}
                <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Current Currency</div>
                                <div className="text-3xl font-bold mt-1">{settings?.code || "EUR"}</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                    Symbol: {settings?.symbol} • Position: {settings?.symbolPosition}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Preview</div>
                                <div className="text-3xl font-bold text-primary mt-1">{previewFormatted}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    DDV {formData.taxRates.standard}% {formData.taxInclusive ? "(vključen)" : "(izključen)"}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Presets */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Quick Presets</CardTitle>
                        <CardDescription>Hitro preklopi med pogostimi valutami</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {presets.map(preset => (
                                <button
                                    key={preset.code}
                                    onClick={() => handleApplyPreset(preset.code)}
                                    className={cn(
                                        "p-4 rounded-lg border text-left transition-all hover:shadow-md",
                                        formData.code === preset.code
                                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                            : "border-border hover:border-muted-foreground/30"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold text-lg">{preset.symbol}</div>
                                        {formData.code === preset.code && (
                                            <CheckCircle2 className="size-4 text-primary" />
                                        )}
                                    </div>
                                    <div className="text-xs font-semibold mt-1">{preset.code}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{preset.name}</div>
                                    <div className="text-[10px] text-muted-foreground mt-2">
                                        Tax: {preset.standardTaxRate}%
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Custom settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Custom Configuration</CardTitle>
                        <CardDescription>Podrobne nastavitve valute in oblikovanja</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Code */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Currency Code (ISO 4217)</Label>
                                <Input
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().slice(0, 3) })}
                                    placeholder="EUR"
                                    maxLength={3}
                                />
                            </div>

                            {/* Symbol */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Symbol</Label>
                                <Input
                                    value={formData.symbol}
                                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                                    placeholder="€"
                                />
                            </div>

                            {/* Symbol position */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Symbol Position</Label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setFormData({ ...formData, symbolPosition: "before" })}
                                        className={cn(
                                            "flex-1 py-2 px-3 rounded-md border text-sm transition-all",
                                            formData.symbolPosition === "before"
                                                ? "border-primary bg-primary/10"
                                                : "border-border"
                                        )}
                                    >
                                        {formData.symbol}10
                                    </button>
                                    <button
                                        onClick={() => setFormData({ ...formData, symbolPosition: "after" })}
                                        className={cn(
                                            "flex-1 py-2 px-3 rounded-md border text-sm transition-all",
                                            formData.symbolPosition === "after"
                                                ? "border-primary bg-primary/10"
                                                : "border-border"
                                        )}
                                    >
                                        10{formData.symbol}
                                    </button>
                                </div>
                            </div>

                            {/* Decimals */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Decimal Places</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="4"
                                    value={formData.decimals}
                                    onChange={(e) => setFormData({ ...formData, decimals: parseInt(e.target.value) || 0 })}
                                />
                            </div>

                            {/* Thousands separator */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Thousands Separator</Label>
                                <Input
                                    value={formData.thousandsSeparator}
                                    onChange={(e) => setFormData({ ...formData, thousandsSeparator: e.target.value })}
                                    placeholder="."
                                    maxLength={2}
                                />
                            </div>

                            {/* Decimal separator */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Decimal Separator</Label>
                                <Input
                                    value={formData.decimalSeparator}
                                    onChange={(e) => setFormData({ ...formData, decimalSeparator: e.target.value })}
                                    placeholder=","
                                    maxLength={2}
                                />
                            </div>

                            {/* Locale */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Locale</Label>
                                <Input
                                    value={formData.locale}
                                    onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                                    placeholder="sl-SI"
                                />
                            </div>

                            {/* Tax inclusive */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Tax Display Mode</Label>
                                <label className="flex items-center justify-between p-2.5 rounded-md border cursor-pointer hover:bg-accent">
                                    <div>
                                        <div className="text-sm font-medium">Tax included in prices</div>
                                        <div className="text-xs text-muted-foreground">Slovenija: yes (DDV vključen)</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={formData.taxInclusive}
                                        onChange={(e) => setFormData({ ...formData, taxInclusive: e.target.checked })}
                                        className="size-4"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Tax rates */}
                        <div className="mt-6 pt-4 border-t">
                            <div className="text-sm font-semibold mb-3">Tax Rates (DDV)</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Standard Rate (%)</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={formData.taxRates.standard}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            taxRates: { ...formData.taxRates, standard: parseFloat(e.target.value) || 0 }
                                        })}
                                    />
                                    <div className="text-[10px] text-muted-foreground">Slovenija: 22%</div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Reduced Rate (%)</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={formData.taxRates.reduced}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            taxRates: { ...formData.taxRates, reduced: parseFloat(e.target.value) || 0 }
                                        })}
                                    />
                                    <div className="text-[10px] text-muted-foreground">Slovenija: 9.5%</div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Special Reduced (%)</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={formData.taxRates.specialReduced}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            taxRates: { ...formData.taxRates, specialReduced: parseFloat(e.target.value) || 0 }
                                        })}
                                    />
                                    <div className="text-[10px] text-muted-foreground">Slovenija: 5%</div>
                                </div>
                            </div>
                        </div>

                        {/* Save button */}
                        <div className="mt-6 flex justify-end gap-2">
                            <Button
                                onClick={handleSave}
                                disabled={isLoading}
                            >
                                <Save className="size-4 mr-2" />
                                {isLoading ? "Saving..." : "Save Settings"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
};

export default CurrencySettings;
