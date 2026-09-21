"""Central configuration for the paper trading bot."""

# Trading pair and exchange
SYMBOL = "BTC/USDT"
EXCHANGE = "binance"
TIMEFRAME = "5m"
CANDLE_LIMIT = 100  # number of candles to fetch per tick

# EMA strategy parameters
FAST_EMA = 9
SLOW_EMA = 21

# Risk management
STARTING_BALANCE = 200.0         # USD
MAX_RISK_PCT = 0.25              # max 25% of balance risked per trade
STOP_LOSS_PCT = 0.015           # 1.5% below entry
TAKE_PROFIT_PCT = 0.030         # 3.0% above entry  →  2:1 R:R

# Minimum candles a position must be open before a signal-based exit is allowed.
# Prevents getting shaken out by the first opposing crossover on noisy candles.
MIN_CANDLES_IN_TRADE = 3

# Loop interval (seconds between each tick)
LOOP_INTERVAL = 300
