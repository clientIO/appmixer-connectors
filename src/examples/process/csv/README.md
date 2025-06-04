# About
Connectors and components in this directory are used to process large CSV files.

## ProcessLargeCSV1
This example demonstrates how to process a large CSV file using the `ProcessLargeCSV1` connector. It reads the CSV file in chunks, processes each chunk, and outputs the results.

Features:
- safely processes large CSV files chunking the original Appmixer stream into smaller chunks
- the final read stream is `csv-reader` which reads the CSV file and emits each row as a JSON object
- custom logic is implemented and hardcoded in the component to transform data into the desired format
- the file is then written to a new CSV file using Appmixer streams again

Example run 1) on Appmixer engine pod:
- 100000 rows in the original CSV file
- ~150000 rows in the final CSV file
- up to 1 second processing time

Example run 2) on Appmixer engine pod:
- 1505101 rows in the original CSV file, 90MB in size
- 1884146 rows in the final CSV file
- 2025-06-04T20:09:44.793Z started processing
- 2025-06-04T20:10:21.556Z finished processing

Not included in the example:
- no timeouts are set, so the process will run until completion
- no retry logic is implemented, so if the process fails, it will not retry
- customizable options for the `csv-reader` stream are not included, but can be added as needed. See for example the `appmixer.utils.csv.AddRows` or `appmixer.utils.csv.GetRows` components for more details.

## ProcessLargeCSV2
This example demonstrates how to process a large CSV file using the `ProcessLargeCSV2` connector. It reads the CSV file in chunks, processes each chunk with `dtl-js` transform object, and outputs the results. See https://getdtl.org/.

This is very similar to `ProcessLargeCSV1`, but uses `dtl-js` to transform the data instead of hardcoded logic in the component. This allows for more flexibility and reusability of the transformation logic. No custom logic is implemented in the component javascript code.

Example run 2) on Appmixer engine pod:
- 1505101 rows in the original CSV file, 90MB in size
- 1884146 rows in the final CSV file
- 2025-06-04T20:09:44.937Z started processing
- 2025-06-04T20:10:27.208Z finished processing (slightly longer than `ProcessLargeCSV1` due to the transformation logic)

Known issues:
- in order to add newline characters to the CSV file, you can't use "\n" in the `dtl-js` transform object, but rather use the `\n` character directly (press Enter in the `tranformation` field in the UI).
