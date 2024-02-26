'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        // Common for GetInvoice, CreateInvoice and UpdateInvoice.
        // Also doesn't eat up the rate limit.
        return this.getOutputPortOptions(context);
    },

    getOutputPortOptions(context) {

        return context.sendJson(
            [
                { label: "Invoice ID", value: "invoice_id" },
                { label: "ACH Payment Initiated", value: "ach_payment_initiated" },
                { label: "Invoice number", value: "invoice_number" },
                { label: "Is Pre GST", value: "is_pre_gst" },
                { label: "Place of Supply", value: "place_of_supply" },
                { label: "GST Number", value: "gst_no" },
                { label: "GST Treatment", value: "gst_treatment" },
                { label: "CFDI Usage", value: "cfdi_usage" },
                { label: "VAT Treatment", value: "vat_treatment" },
                { label: "Tax Treatment", value: "tax_treatment" },
                { label: "VAT Registration Number", value: "vat_reg_no" },
                { label: "Date", value: "date" },
                { label: "Status", value: "status" },
                { label: "Payment Terms", value: "payment_terms" },
                { label: "Payment Terms Label", value: "payment_terms_label" },
                { label: "Due Date", value: "due_date" },
                { label: "Payment Expected Date", value: "payment_expected_date" },
                { label: "Last Payment Date", value: "last_payment_date" },
                { label: "Reference Number", value: "reference_number" },
                { label: "Customer ID", value: "customer_id" },
                { label: "Customer Name", value: "customer_name" },
                {
                    label: "Contact Persons", value: "contact_persons",
                    schema: {
                        type: "array", items: { type: "string" }
                    }
                },
                { label: "Currency ID", value: "currency_id" },
                { label: "Currency Code", value: "currency_code" },
                { label: "Exchange Rate", value: "exchange_rate" },
                { label: "Discount", value: "discount" },
                { label: "Is Discount Before Tax", value: "is_discount_before_tax" },
                { label: "Discount Type", value: "discount_type" },
                { label: "Is Inclusive Tax", value: "is_inclusive_tax" },
                { label: "Recurring Invoice ID", value: "recurring_invoice_id" },
                { label: "Is Viewed by Client", value: "is_viewed_by_client" },
                { label: "Has Attachment", value: "has_attachment" },
                { label: "Client Viewed Time", value: "client_viewed_time" },
                {
                    label: "Line Items", value: "line_items", schema: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                line_item_id: { title: "Line Item ID", type: "number" },
                                item_id: { title: "Item ID", type: "number" },
                                project_id: { title: "Project ID", type: "number" },
                                project_name: { title: "Project Name", type: "string" },
                                time_entry_ids: {
                                    title: "Time Entry IDs",
                                    schema: {
                                        type: "array",
                                        items: {
                                            type: "string"
                                        }
                                    }
                                },
                                warehouses: {
                                    title: "Warehouses",
                                    schema: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                warehouse_id: { title: "Warehouse ID", type: "string" },
                                                warehouse_name: { title: "Warehouse Name", type: "string" },
                                                warehouse_stock_on_hand: { title: "Warehouse Stock On Hand", type: "string" }
                                            }
                                        }
                                    }
                                },
                                item_type: { title: "Item Type", type: "string" },
                                product_type: { title: "Product Type", type: "string" },
                                expense_id: { title: "Expense ID", type: "string" },
                                expense_receipt_name: { title: "Expense Receipt Name", type: "string" },
                                name: { title: "Name", type: "string" },
                                description: { title: "Description", type: "string" },
                                item_order: { title: "Item Order", type: "number" },
                                bcy_rate: { title: "BCY Rate", type: "number" },
                                rate: { title: "Rate", type: "number" },
                                quantity: { title: "Quantity", type: "number" },
                                unit: { title: "Unit", type: "string" },
                                discount_amount: { title: "Discount Amount", type: "number" },
                                discount: { title: "Discount", type: "number" },
                                tags: {
                                    title: "Tags",
                                    schema: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                is_tag_mandatory: { title: "Is Tag Mandatory", type: "boolean" },
                                                tag_id: { title: "Tag ID", type: "number" },
                                                tag_name: { title: "Tag Name", type: "string" },
                                                tag_option_id: { title: "Tag Option ID", type: "number" },
                                                tag_option_name: { title: "Tag Option Name", type: "string" }
                                            }
                                        }
                                    }
                                },
                                tax_id: { title: "Tax ID", type: "number" },
                                tax_name: { title: "Tax Name", type: "string" },
                                tax_type: { title: "Tax Type", type: "string" },
                                tax_percentage: { title: "Tax Percentage", type: "number" },
                                tax_treatment_code: { title: "Tax Treatment Code", type: "string" },
                                item_total: { title: "Item Total", type: "number" },
                                header_name: { title: "Header Name", type: "string" },
                                header_id: { title: "Header ID", type: "number" }
                            }
                        }
                    }
                },
                { label: "Shipping Charge", value: "shipping_charge" },
                { label: "Adjustment", value: "adjustment" },
                { label: "Adjustment Description", value: "adjustment_description" },
                { label: "Sub Total", value: "sub_total" },
                { label: "Tax Total", value: "tax_total" },
                { label: "Total", value: "total" },
                {
                    label: "Taxes", value: "taxes", schema: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                tax_name: { type: "string", title: "Tax name" },
                                tax_amount: { type: "number", title: "Tax amount" }
                            }
                        }
                    }
                },
                { label: "Payment Reminder Enabled", value: "payment_reminder_enabled" },
                { label: "Payment Made", value: "payment_made" },
                { label: "Credits Applied", value: "credits_applied" },
                { label: "Tax Amount Withheld", value: "tax_amount_withheld" },
                { label: "Balance", value: "balance" },
                { label: "Write-Off Amount", value: "write_off_amount" },
                { label: "Allow Partial Payments", value: "allow_partial_payments" },
                { label: "Price Precision", value: "price_precision" },
                { label: "Payment Options", value: "payment_options" },
                {
                    label: "Payment Gateways", value: "payment_options.payment_gateways", schema: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                configured: { type: "boolean", title: "Configured" },
                                additional_field1: { type: "string", title: "Additional field 1" },
                                gateway_name: { type: "string", title: "Gateway name" }
                            }
                        }
                    }
                },
                { label: "Is Emailed", value: "is_emailed" },
                { label: "Reminders Sent", value: "reminders_sent" },
                { label: "Last Reminder Sent Date", value: "last_reminder_sent_date" },
                {
                    label: "Billing Address", value: "billing_address", schema: {
                        type: "object",
                        properties: {
                            address: { type: "string", title: "Billing address - Address" },
                            attention: { type: "string", label: "Attention" },
                            street2: { type: "string", title: "Billing address - Street 2" },
                            city: { type: "string", title: "Billing address - City" },
                            state: { type: "string", title: "Billing address - State" },
                            zip: { type: "string", title: "Billing address - ZIP" },
                            country: { type: "string", title: "Billing address - Country" },
                            phone: { type: "string", title: "Billing address - Phone" },
                            fax: { type: "string", title: "Billing address - Fax" }
                        }
                    }
                },
                {
                    label: "Shipping Address", value: "shipping_address", schema: {
                        type: "object",
                        properties: {
                            address: { type: "string", title: "Shipping address - Address" },
                            attention: { type: "string", label: "Attention" },
                            street2: { type: "string", title: "Shipping address - Street 2" },
                            city: { type: "string", title: "Shipping address - City" },
                            state: { type: "string", title: "Shipping address - State" },
                            zip: { type: "string", title: "Shipping address - ZIP" },
                            country: { type: "string", title: "Shipping address - Country" },
                            phone: { type: "string", title: "Shipping address - Phone" },
                            fax: { type: "string", title: "Shipping address - Fax" }
                        }
                    }
                },
                { label: "Notes", value: "notes" },
                { label: "Terms", value: "terms" },
                {
                    label: "Custom fields", value: "custom_fields", schema: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                customfield_id: { type: "string", title: "Custom field ID" },
                                value: { type: "any", title: "Value" },
                                data_type: { type: "string", title: "Data type" },
                                index: { type: "number", title: "Index" }
                            }
                        }
                    }
                },
                { label: "Template ID", value: "template_id" },
                { label: "Template Name", value: "template_name" },
                { label: "Created Time", value: "created_time" },
                { label: "Last Modified Time", value: "last_modified_time" },
                { label: "Attachment Name", value: "attachment_name" },
                { label: "Can Send in Mail", value: "can_send_in_mail" },
                { label: "Salesperson ID", value: "salesperson_id" },
                { label: "Salesperson Name", value: "salesperson_name" },
                { label: "Invoice URL", value: "invoice_url" }
            ],
            'out'
        );
    }
};
