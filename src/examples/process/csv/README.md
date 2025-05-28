# About
Connectors and components in this directory are used to process large CSV files.

## ProcessLargeCSV1
This example demonstrates how to process a large CSV file using the `ProcessLargeCSV1` connector. It reads the CSV file in chunks, processes each chunk, and outputs the results.

Features:
- safely processes large CSV files chunking the original Appmixer stream into smaller chunks
- the final read stream is `csv-reader` which reads the CSV file and emits each row as a JSON object
- custom logic is implemented to transform data into the desired format
- the file is then written to a new CSV file using Appmixer streams again

Example run 1) on Appmixer engine pod:
- 100000 rows in the original CSV file
- ~150000 rows in the final CSV file
- up to 1 second processing time

Example run 2) on Appmixer engine pod:
- 1505101 rows in the original CSV file
- 1884146 rows in the final CSV file
- 2025-05-28T18:12:22.702Z started processing
- 2025-05-28T18:12:33.134Z finished processing

Not included in the example:
- no timeouts are set, so the process will run until completion
- no retry logic is implemented, so if the process fails, it will not retry
