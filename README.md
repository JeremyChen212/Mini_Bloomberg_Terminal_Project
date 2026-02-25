# Mini_Bloomberg_Terminal_Project

### Steps to use Ingestion Layer
1. Be in bash and activate the environment
2. Install Dependencies
   
   `pip install yfinance pandas requests eventregistry dotenv`
   
3. Make an account at https://eventregistry.org/ and get your API Key
 
5. Set your EventRegistry API Key

   `conda env config vars set EVENTREGISTRY_API_KEY = your_actual_key_here`

   Reactivate environment
   
6. Run Ingestion layer(replace AAPL with any ticker you desire; in this example AAPL = APPLE)
   
   `python -m ingestion.run_ingestion --ticker AAPL`

7. After successful execution
   * Raw data will be saved in the `/raw` directory
   * Processed data will be saved in the `/processed` directory
   
