# Mini_Bloomberg_Terminal_Project

### Steps to use Ingestion Layer
1. Be in bash and activate the environment
2. Install Dependencies
   
   `pip install yfinance pandas requests eventregistry dotenv`
   
3. Make an account at https://newsapi.ai/?gad_source=1&gad_campaignid=16130462799&gbraid=0AAAAADFDRCBOrOJiVD8k6jG7EOYwSqu8n&gclid=CjwKCAiA2PrMBhA4EiwAwpHyC2DTAJA_6FDwgzVWrl-2rPuCmPz3TLa40HouGxL9m99Fu2CwxsLdlhoCtdwQAvD_BwE and get your API Key
 
5. Set your EventRegistry API Key

   `conda env config vars set EVENTREGISTRY_API_KEY = your_actual_key_here`

   Reactivate environment
   
6. Run Ingestion layer(replace AAPL with any ticker you desire; in this example AAPL = APPLE)
   
   `python -m ingestion.run_ingestion --ticker AAPL`

7. After successful execution
   * Raw data will be saved in the `/raw` directory
   * Processed data will be saved in the `/processed` directory

### Steps to run the frontend
1. Navigate to the client app
`cd Mini_Bloomberg_Terminal_Project/client`

2. Install dependencies (only needed once)
`npm install`

3. Start the dev server
`npm run dev`
`→ App runs at http://localhost:5173`
