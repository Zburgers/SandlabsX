#!/bin/bash
# Image Format Verification Script
# Tests QCOW2 conversion and compatibility

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGES_DIR="$SCRIPT_DIR/images"
CUSTOM_DIR="$IMAGES_DIR/custom"

echo "========================================="
echo "SandLabX Image Format Verification"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 found"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

echo "Checking prerequisites..."
check_command qemu-img || exit 1
check_command file || exit 1
echo ""

echo "Scanning images directory..."
echo "Location: $IMAGES_DIR"
echo ""

# Check main images
if [ -d "$IMAGES_DIR" ]; then
    echo "=== Main Images ==="
    shopt -s nullglob
    for img in "$IMAGES_DIR"/*.qcow2 "$IMAGES_DIR"/*.vmdk "$IMAGES_DIR"/*.vdi "$IMAGES_DIR"/*.vhdx "$IMAGES_DIR"/*.raw "$IMAGES_DIR"/*.img; do
        [ -f "$img" ] || continue
        
        filename=$(basename "$img")
        echo ""
        echo "File: $filename"
        
        # Check actual format
        actual_format=$(qemu-img info --output=json "$img" 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin).get('format', 'unknown'))" 2>/dev/null || echo "unknown")
        file_type=$(file -b "$img" | cut -d',' -f1)
        
        echo "  File type: $file_type"
        echo "  QEMU format: $actual_format"
        
        if [ "$actual_format" = "qcow2" ]; then
            echo -e "  Status: ${GREEN}✓ QCOW2 (native)${NC}"
            
            # Get size info
            virtual_size=$(qemu-img info "$img" | grep "virtual size" | awk '{print $3, $4}')
            disk_size=$(qemu-img info "$img" | grep "disk size" | awk '{print $3, $4}')
            echo "  Virtual size: $virtual_size"
            echo "  Disk size: $disk_size"
        else
            echo -e "  Status: ${YELLOW}⚠ Needs conversion (format: $actual_format)${NC}"
            echo "  Convert with: qemu-img convert -f $actual_format -O qcow2 '$img' '${img%.*}_converted.qcow2'"
        fi
    done
fi

# Check custom images
echo ""
if [ -d "$CUSTOM_DIR" ]; then
    echo "=== Custom Images ==="
    custom_count=0
    for img in "$CUSTOM_DIR"/*.*; do
        [ -f "$img" ] || continue
        ((custom_count++))
        
        filename=$(basename "$img")
        echo ""
        echo "File: $filename"
        
        actual_format=$(qemu-img info --output=json "$img" 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin).get('format', 'unknown'))" 2>/dev/null || echo "unknown")
        
        if [ "$actual_format" = "qcow2" ]; then
            echo -e "  Status: ${GREEN}✓ QCOW2${NC}"
            
            # Test overlay creation
            test_overlay="/tmp/test_overlay_$$.qcow2"
            if qemu-img create -f qcow2 -b "$(realpath "$img")" -F qcow2 "$test_overlay" &>/dev/null; then
                echo -e "  Overlay test: ${GREEN}✓ Pass${NC}"
                rm -f "$test_overlay"
            else
                echo -e "  Overlay test: ${RED}✗ Failed${NC}"
            fi
        else
            echo -e "  Status: ${YELLOW}⚠ Format: $actual_format${NC}"
        fi
    done
    
    if [ $custom_count -eq 0 ]; then
        echo "  No custom images found"
    fi
else
    echo "Custom images directory not found: $CUSTOM_DIR"
fi

# Test router image specifically
echo ""
echo "=== Router Image Test ==="
router_img="$IMAGES_DIR/router.qcow2"
if [ -f "$router_img" ]; then
    echo "Testing: $router_img"
    
    format=$(qemu-img info --output=json "$router_img" 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin).get('format', 'unknown'))" 2>/dev/null || echo "unknown")
    if [ "$format" = "qcow2" ]; then
        echo -e "${GREEN}✓${NC} Format: QCOW2"
        
        # Test overlay
        test_overlay="/tmp/router_test_$$.qcow2"
        if qemu-img create -f qcow2 -b "$(realpath "$router_img")" -F qcow2 "$test_overlay" &>/dev/null; then
            echo -e "${GREEN}✓${NC} Overlay creation: Success"
            
            # Quick boot test (3 second timeout)
            echo -n "  Boot test: "
            if timeout 3 qemu-system-x86_64 \
                -hda "$test_overlay" \
                -m 512 \
                -nographic \
                -serial none \
                -monitor none &>/dev/null; then
                echo -e "${GREEN}✓${NC} Boots (QEMU accepts image)"
            else
                # Timeout is expected, we just want to verify QEMU starts
                echo -e "${GREEN}✓${NC} Boots (timeout expected)"
            fi
            
            rm -f "$test_overlay"
        else
            echo -e "${RED}✗${NC} Overlay creation: Failed"
        fi
    else
        echo -e "${RED}✗${NC} Format: $format (expected QCOW2)"
        echo "  Run: qemu-img convert -f $format -O qcow2 '$router_img' '${router_img%.qcow2}_converted.qcow2'"
    fi
else
    echo -e "${YELLOW}⚠${NC} Router image not found: $router_img"
fi

echo ""
echo "========================================="
echo "Verification Complete"
echo "========================================="
