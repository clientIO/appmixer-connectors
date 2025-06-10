#!/bin/bash
# Script to generate a large CSV file with random values for columns A, B, and C
# Used for ProcessLargeCSV1 component
# Usage: bash _create_large_csv.sh [lines]

lines=${1:-12000}
output_file="large_csv_${lines}.csv"

# Write header
printf "A,B,C\n" > "$output_file"

for ((i=1; i<=lines; i++)); do
    # Randomly decide if A and/or B will have a value (simulate sparsity)
    a_value=""
    b_value=""
    c_value="umid_$RANDOM"
    if (( RANDOM % 2 )); then
        a_value="id_$RANDOM"
    fi
    if (( RANDOM % 2 )); then
        b_value="id_$RANDOM"
    fi
	# Ensure at least one of A or B has a value
	if [[ -z "$a_value" && -z "$b_value" ]]; then
		a_value="id_$RANDOM"
	fi
    printf "%s,%s,%s\n" "$a_value" "$b_value" "$c_value" >> "$output_file"
done

echo "Generated $output_file with $lines lines."
