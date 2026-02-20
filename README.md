# Mini_Bloomberg_Terminal_Project

### Steps to use Ingestion Layer
1. Be in bash and make sure you are in the right folder
2. Install Dependencies
   pip install yfinance pandas requests
3. Run Ingestion layer(replace AAPL with any ticker you desire; in this example AAPL = APPLE)
   python -m ingestion.run_ingestion --ticker AAPL
4. After successful execution
   * Raw data will be saved in the `/raw` directory
   * Processed data will be saved in the `/processed` directory
   
