# Squarespace Pendo Tracking Setup

## Overview
This guide explains how to add Pendo tracking attributes to the signup buttons on textaside.com (Squarespace site).

## Instructions

1. **Log into your Squarespace account** for textaside.com

2. **Navigate to Settings → Advanced → Code Injection**

3. **Add the following JavaScript to the FOOTER section:**

```html
<script>
  // Add Pendo tracking attributes to signup page buttons
  (function() {
    console.log('Pendo button tagging script loaded');
    
    function addPendoAttributes() {
      // Find the "Send a text to get started" button
      const smsButton = document.querySelector('a[href^="sms:"]');
      if (smsButton && !smsButton.hasAttribute('data-pendo')) {
        smsButton.setAttribute('data-pendo', 'button-send-text-signup');
        console.log('✓ SMS button tagged:', smsButton);
      }
      
      // Find the "Download the number to your iPhone" button
      const downloadButton = document.querySelector('a[href*=".vcf"]');
      if (downloadButton && !downloadButton.hasAttribute('data-pendo')) {
        downloadButton.setAttribute('data-pendo', 'button-download-vcf-iphone');
        console.log('✓ Download button tagged:', downloadButton);
      }
      
      console.log('Pendo attributes check complete');
    }
    
    // Run on page load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addPendoAttributes);
    } else {
      addPendoAttributes();
    }
  })();
</script>
```

## Expected Results

After adding this script, when you open the textaside.com homepage:

1. **Open browser console** (F12 → Console tab)
2. **You should see:**
   ```
   Pendo button tagging script loaded
   ✓ SMS button tagged: <a href="sms:+14582188508">
   ✓ Download button tagged: <a href="/s/CONTEXT.vcf">
   Pendo attributes check complete
   ```

3. **Verify in console:**
   ```javascript
   // Check SMS button
   console.log(document.querySelector('a[data-pendo="button-send-text-signup"]'));
   // Should return: <a href="sms:..." data-pendo="button-send-text-signup">
   
   // Check download button
   console.log(document.querySelector('a[data-pendo="button-download-vcf-iphone"]'));
   // Should return: <a href="/s/CONTEXT.vcf" data-pendo="button-download-vcf-iphone">
   ```

## Button Tracking

Once implemented, Pendo will track clicks on:
- **SMS Button** → `data-pendo="button-send-text-signup"`
- **Download VCF Button** → `data-pendo="button-download-vcf-iphone"`

## Troubleshooting

### Script Not Running?
- Make sure it's in the **Footer** section, not Header
- Check for JavaScript errors in the console
- Verify the selectors match your actual HTML structure

### Buttons Not Found?
If console shows "null" for buttons, the selectors might need adjustment. To find the correct selectors:
1. Right-click on the button → Inspect
2. Note the exact href attribute
3. Update the selectors in the script accordingly

### Testing After Deployment
Run these commands in the browser console:
```javascript
// Test SMS button
document.querySelector('a[data-pendo="button-send-text-signup"]')

// Test download button  
document.querySelector('a[data-pendo="button-download-vcf-iphone"]')
```

Both should return the corresponding button elements (not `null`).

## Notes
- This script runs on every page load
- It only adds attributes if they don't already exist (prevents duplicates)
- Console logs help verify it's working correctly
- The script is non-invasive and won't affect button functionality
