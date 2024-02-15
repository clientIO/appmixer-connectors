# Amazon Marketplace

## Developer docs
https://developer-docs.amazon.com
https://github.com/amzn/selling-partner-api-models

### Tutorials, SO
- https://www.youtube.com/watch?v=gp5kTI8I3pU, update of https://www.youtube.com/watch?v=BGmx-9C1aoM
- https://stackoverflow.com/questions/71493378/amazon-selling-partner-api-how-to-update-price-and-quantity-of-the-product

## Requirements
- Professional Selling Account
    - https://www.sellerapp.com/blog/become-an-amazon-individual-seller/
- Application registered with Amazon Marketplace

### Register your application
https://developer-docs.amazon.com/sp-api/docs/registering-your-application

## Generate module

```sh
appmixer init openapi ./amazonmarketplace/openapi-catalogItems_2022-04-01.json ./amazonmarketplace/
appmixer init openapi ./amazonmarketplace/openapi-listingsItems_2021-08-01.json ./amazonmarketplace/
```
