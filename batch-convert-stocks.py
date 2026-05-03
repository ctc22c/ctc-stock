#!/usr/bin/env python3
"""
Batch convert stock HTML files from dark theme to light theme
"""
import os
import re

# Theme conversion mappings
REPLACEMENTS = [
    # Background and main colors
    ('background: radial-gradient(circle at top left, rgba(6, 182, 212, 0.16), transparent 18%), radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 12%), linear-gradient(180deg, #07101f 0%, #04070f 100%); color: #e2e8f0;',
     'background-color: #F8FAFC; color: #0f172a;'),
    
    # Glass effect
    ('background: rgba(12, 18, 32, 0.82); border: 1px solid rgba(56, 189, 248, 0.14); backdrop-filter: blur(24px); box-shadow: 0 22px 100px rgba(15, 23, 42, 0.28);',
     'background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(203, 213, 225, 0.5);'),
    
    # Accent cards
    ('background: rgba(15, 23, 42, 0.76); border: 1px solid rgba(56, 189, 248, 0.18);',
     'background: rgba(248, 250, 252, 0.8); border: 1px solid rgba(203, 213, 225, 0.6);'),
    
    # Primary buttons
    ('background: linear-gradient(135deg, #0ea5e9, #22d3ee);',
     'background: linear-gradient(135deg, #0056B3, #003D80); color: white;'),
    
    # Button hover
    ('background: linear-gradient(135deg, #38bdf8, #22c55e);',
     'background: linear-gradient(135deg, #004494, #003370);'),
    
    # Badge
    ('background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(148, 163, 184, 0.16);',
     'background: rgba(248, 250, 252, 0.95); border: 1px solid rgba(203, 213, 225, 0.5); color: #475569;'),
    
    # Metric cards
    ('background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.16);',
     'background: rgba(248, 250, 252, 0.9); border: 1px solid rgba(203, 213, 225, 0.5);'),
    
    # Chart box
    ('background: linear-gradient(180deg, rgba(15,23,42,0.95), rgba(15,23,42,0.72)); border: 1px solid rgba(56, 189, 248, 0.14);',
     'background: linear-gradient(180deg, rgba(248,250,252,0.95), rgba(248,250,252,0.8)); border: 1px solid rgba(203, 213, 225, 0.5);'),
    
    # Cyan status badge (inline HTML)
    ('span id="liveStatus" class="rounded-full bg-slate-900/90 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-300">Live</span>',
     'span id="liveStatus" class="rounded-full bg-emerald-100 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-700 font-semibold">Live</span>'),
    
    # Text colors - slate-400 to slate-600
    ('text-slate-400">CTC Capital</p>',
     'text-blue-600 font-semibold">CTC Capital</p>'),
    
    ('text-white">Apple Inc',
     'text-slate-900">Apple Inc'),
    
    ('text-slate-400">Live',
     'text-slate-600">Real-time'),
    
    ('text-slate-300">Action</label>',
     'text-slate-700">Action</label>'),
    
    ('border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20',
     'border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20'),
    
    ('border-slate-700/50 bg-slate-950/80 p-4 text-slate-300',
     'border-slate-200 bg-slate-50 p-4 text-slate-700'),
    
    ('border-slate-700/50 bg-slate-950/80 p-6 text-slate-400">No',
     'border-slate-200 bg-slate-50 p-6 text-slate-600">No'),
    
    # Transaction status badges
    ('bg-slate-900/90 px-4 py-2 text-xs text-slate-300',
     'bg-amber-100 text-amber-700 px-4 py-2 text-xs font-semibold'),
    
    # Holdngs and transaction sections
    ('text-slate-400">Total', 'text-slate-600 font-semibold">Total'),
    ('text-white">0.00</p>', 'text-slate-900">0.00</p>'),
    ('text-slate-300">Pending', 'text-slate-700">Pending'),
]

STOCK_FILES = [
    "tesla.html",
    "google.html", 
    "microsoft.html",
    "amazon.html",
    "btc.html",
    "eth.html",
    "oil-gas.html",
    "tech-index.html",
    "dangote.html",
    "elon-musk.html",
    "bill-gates.html"
]

STOCK_DIR = r"c:\Users\USER\OneDrive\Desktop\ctc stock\stock-invest-pro\pages\stocks"

def convert_file(filepath):
    """Convert a single stock file to light theme"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_length = len(content)
        
        # Apply replacements
        for old, new in REPLACEMENTS:
            content = content.replace(old, new)
        
        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return True, f"✓ Converted ({len(content)} bytes)"
    except Exception as e:
        return False, f"✗ Error: {str(e)}"

if __name__ == "__main__":
    print("🎨 Stock Files Dark → Light Theme Conversion")
    print("=" * 60)
    
    converted = 0
    failed = 0
    
    for filename in STOCK_FILES:
        filepath = os.path.join(STOCK_DIR, filename)
        if os.path.exists(filepath):
            success, msg = convert_file(filepath)
            status = "✓" if success else "✗"
            print(f"{status} {filename:<25} {msg}")
            if success:
                converted += 1
            else:
                failed += 1
        else:
            print(f"✗ {filename:<25} File not found")
            failed += 1
    
    print("=" * 60)
    print(f"Result: {converted} converted, {failed} failed")
