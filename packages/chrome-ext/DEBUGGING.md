# Debugging the JIXO Chrome Extension

When the extension doesn't seem to be working (e.g., clicking the icon does nothing), it's almost always an issue with the background Service Worker. Here’s how to debug it.

## 1. Verify the Build

First, ensure you have built the extension using Vite. The output will be in the `dist` directory.

```sh
# From within the packages/chrome-ext directory
pnpm build
```

## 2. Load the Correct Directory in Chrome

When loading the extension in Chrome, make sure you are loading the **`dist`** directory, not the project's root directory.

1.  Go to `chrome://extensions/`.
2.  Enable "Developer mode".
3.  Click "Load unpacked".
4.  Select the `packages/chrome-ext/dist` folder.

## 3. How to Open the Service Worker Console (Crucial Step)

The background script (`background.ts`) runs in a special environment called a Service Worker. Its logs **do not** appear in the regular browser console of the web page.

1.  Go to `chrome://extensions/`.
2.  Find the "JIXO AI-Studio" extension card.
3.  Click the **"Service Worker"** link.

![Service Worker Link](https://i.imgur.com/your-image-link-here.png) <!-- Placeholder for image -->

This will open a dedicated DevTools window for the background script. **All logs from `background.ts` will appear here.** Look for any error messages. If the Service Worker crashed on startup, this window might open and close immediately, but any errors will be logged in the Chrome error log (`chrome://crashes/` if enabled, or check system logs).

## 4. How to Debug the Popup Window

The popup window is a regular HTML page and has its own DevTools.

1.  Click the JIXO extension icon to open the popup.
2.  **Right-click** anywhere inside the popup window.
3.  Select **"Inspect"**.

This will open a DevTools window specifically for the popup. Logs from `popup.tsx` and its child components will appear here.

## Common Problems

- **"Service Worker" link is inactive or shows errors:** This means `background.js` failed to load. Check the `dist` directory to make sure the file exists. Check for syntax errors at the top level of `background.ts`.
- **WebSocket connection errors:** Look for errors in the Service Worker console. It will show if the connection to `ws://127.0.0.1:8765` is failing. Ensure your `jixo-node` server is running.
- **Popup is blank or shows an error:** Open the popup's inspector (Step 4) to see errors from React or the popup script itself.

By following these steps and checking the correct consoles, you can quickly diagnose almost any issue with the extension.
