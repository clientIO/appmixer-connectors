# About
Connectors and components in this directory are used to process large CSV files.

## ProcessLargeCSV1
This component handles 3MB CSV file with 100k rows and 7 columns. It is processed in about 1 second.

Features:
- safely processes large CSV files chunking the original Appmixer stream into smaller chunks
- the final read stream is `csv-reader` which reads the CSV file and emits each row as a JSON object
- custom logic is implemented to transform data into the desired format
- the file is then written to a new CSV file using Appmixer streams again

Not included in the example:
- no timeouts are set, so the process will run until completion
- no retry logic is implemented, so if the process fails, it will not retry
