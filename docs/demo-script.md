## Backup and restore demo

1. Log a few outings and note the history, status card, and weekly total.
2. Select **Export data** and save the JSON file.
3. Clear the site's storage, reload the app, and confirm the history is empty.
4. Select **Import JSON**, choose the saved file, and confirm the import summary.
5. Confirm that history, status, and weekly totals match the original.
6. Try a corrupted file, a non-JSON file, an empty file, and a file larger than
   1 MB; each should show an error without changing the saved outings.