"""
Data preprocessing pipeline.

Key steps: merge owner + seller_type from cars.csv, engineer features
(car_age, km_per_year, brand_value_score, model_price_score), cap outliers
at the 1st-99th percentile (so luxury cars aren't dropped), and optionally
add synthetic luxury rows so high budgets still get predictions.
"""

import os
import sys
import warnings
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings('ignore')

CURRENT_YEAR = 2026

ML_DIR   = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(ML_DIR)
DATA_DIR = os.path.join(ROOT_DIR, 'data')

FINAL_DATASET_PATH = os.path.join(DATA_DIR, 'final_dataset.csv')
CARS_CSV_PATH      = os.path.join(DATA_DIR, 'cars.csv')

BRAND_VALUE_MAP = {
    'toyota': 0.95, 'honda': 0.90, 'maruti': 0.88, 'hyundai': 0.85,
    'tata': 0.80,   'mahindra': 0.80, 'ford': 0.75, 'volkswagen': 0.75,
    'renault': 0.72, 'nissan': 0.70, 'chevrolet': 0.68, 'bmw': 0.88,
    'audi': 0.85,   'mercedes': 0.90, 'skoda': 0.73, 'jeep': 0.82,
    'kia': 0.83,    'mg': 0.80,  'land rover': 0.87, 'volvo': 0.84,
    'jaguar': 0.82,
}
DEFAULT_BRAND_SCORE = 0.65

OWNER_MAP = {
    'First Owner'         : 1,
    'Second Owner'        : 2,
    'Third Owner'         : 3,
    'Fourth & Above Owner': 4,
    'Test Drive Car'      : 0,
}

SELLER_MAP = {
    'individual'      : 0,
    'dealer'          : 1,
    'trustmark dealer': 2,
}


def load_and_merge(
    final_path: str = FINAL_DATASET_PATH,
    cars_path:  str = CARS_CSV_PATH,
) -> pd.DataFrame:
    # Load final_dataset.csv and merge owner + seller_type from cars.csv,
    # matching on year + selling_price + km_driven + fuel + transmission.
    df_main = pd.read_csv(final_path)
    df_main.columns = df_main.columns.str.lower().str.strip()

    df_cars = pd.read_csv(cars_path)
    df_cars.columns = df_cars.columns.str.lower().str.strip()

    print(f"[INFO] final_dataset : {df_main.shape[0]} rows")
    print(f"[INFO] cars.csv      : {df_cars.shape[0]} rows")

    for col in ['fuel', 'transmission']:
        df_main[col] = df_main[col].str.lower().str.strip()
        df_cars[col] = df_cars[col].str.lower().str.strip()

    # Cast to numeric/int before merging to avoid int-vs-float key mismatches.
    for col in ['selling_price', 'km_driven']:
        df_main[col] = pd.to_numeric(df_main[col], errors='coerce').round(0)
        df_cars[col] = pd.to_numeric(df_cars[col], errors='coerce').round(0)
    df_main['year'] = pd.to_numeric(df_main['year'], errors='coerce').astype('Int64')
    df_cars['year'] = pd.to_numeric(df_cars['year'], errors='coerce').astype('Int64')

    MERGE_KEYS = ['year', 'selling_price', 'km_driven', 'fuel', 'transmission']

    df_src = (
        df_cars[MERGE_KEYS + ['owner', 'seller_type']]
        .rename(columns={'owner': 'owner_text'})
        .drop_duplicates(subset=MERGE_KEYS)
        .reset_index(drop=True)
    )

    df_merged = df_main.merge(df_src, on=MERGE_KEYS, how='left')

    matched = df_merged['owner_text'].notna().sum()
    print(f"[INFO] Owner+SellerType matched : {matched}/{len(df_merged)} rows "
          f"({matched/len(df_merged)*100:.1f}%)")

    df_merged['owner'] = (
        df_merged['owner_text'].map(OWNER_MAP)
        .combine_first(df_merged['owner'])
    )
    df_merged.drop(columns=['owner_text'], inplace=True)

    df_merged['seller_type'] = (
        df_merged['seller_type']
        .str.lower().str.strip()
        .map(SELLER_MAP)
    )

    print(f"[INFO] seller_type distribution:")
    print(df_merged['seller_type'].value_counts(dropna=False).rename(
        {0.0:'Individual', 1.0:'Dealer', 2.0:'Trustmark', np.nan:'Unknown'}).to_string())

    return df_merged


def add_model_price_score(df: pd.DataFrame) -> pd.DataFrame:
    # Score each model 0-1 by its median price, so the model can tell a
    # Fortuner (~₹25L → ~0.85) from an Alto (~₹2.5L → ~0.12) without the
    # high-cardinality problem of one-hot encoding raw brand_model strings.
    df = df.copy()

    if 'brand_model' not in df.columns:
        df['model_price_score'] = 0.5
        return df

    model_medians = (
        df.groupby('brand_model')['selling_price']
        .median()
        .reset_index()
        .rename(columns={'selling_price': '_model_median'})
    )

    df = df.merge(model_medians, on='brand_model', how='left')

    mn = df['_model_median'].min()
    mx = df['_model_median'].max()
    df['model_price_score'] = (df['_model_median'] - mn) / (mx - mn + 1)
    df['model_price_score'] = df['model_price_score'].fillna(0.5).round(4)
    df.drop(columns=['_model_median'], inplace=True)

    print(f"[INFO] model_price_score added  "
          f"(range: {df['model_price_score'].min():.3f} – "
          f"{df['model_price_score'].max():.3f})")
    return df


def handle_missing_values(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    before = len(df)
    df.dropna(subset=['selling_price'], inplace=True)
    if before - len(df):
        print(f"[INFO] Dropped {before-len(df)} rows: missing selling_price")

    null_owner = df['owner'].isnull().sum()
    if null_owner:
        mode_val = df['owner'].mode()[0]
        df['owner'].fillna(mode_val, inplace=True)
        print(f"[INFO] Filled {null_owner} owner NaNs with mode ({int(mode_val)})")
    df['owner'] = df['owner'].astype(int)

    # Default any unknown seller_type to 0 (Individual).
    null_seller = df['seller_type'].isnull().sum()
    if null_seller:
        df['seller_type'].fillna(0, inplace=True)
        print(f"[INFO] Filled {null_seller} seller_type NaNs with 0 (Individual)")
    df['seller_type'] = df['seller_type'].astype(int)

    df['km_driven'].fillna(df['km_driven'].median(), inplace=True)

    for col in ['fuel', 'transmission', 'brand']:
        if col in df.columns and df[col].isnull().any():
            df[col].fillna(df[col].mode()[0], inplace=True)

    nulls = df.isnull().sum()
    nulls = nulls[nulls > 0]
    print("[INFO] Missing values: NONE" if nulls.empty
          else f"[WARN] Remaining:\n{nulls}")
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['car_age']           = (CURRENT_YEAR - df['year'].astype(int)).clip(lower=1)
    df['km_per_year']       = df['km_driven'] / df['car_age']
    df['brand_value_score'] = (
        df['brand'].str.lower().str.strip()
        .map(BRAND_VALUE_MAP).fillna(DEFAULT_BRAND_SCORE)
    )
    print("[INFO] Engineered: car_age, km_per_year, brand_value_score")
    return df


def remove_outliers(df: pd.DataFrame) -> pd.DataFrame:
    # Cap at the 1st-99th percentile instead of using the IQR fence. IQR removal
    # was deleting all luxury cars (BMW/Audi/Mercedes sit above the upper fence),
    # so the model never learned luxury pricing and high budgets got no results.
    df = df.copy()
    before = len(df)

    for col in ['selling_price', 'km_driven']:
        lo = df[col].quantile(0.01)
        hi = df[col].quantile(0.99)
        df = df[(df[col] >= lo) & (df[col] <= hi)]

    print(f"[INFO] Outlier removal (1st–99th pct): {before} → {len(df)} rows "
          f"(removed {before-len(df)})")
    print(f"[INFO] Price range after: ₹{df['selling_price'].min():,.0f} – "
          f"₹{df['selling_price'].max():,.0f}")
    return df


def add_synthetic_data(df: pd.DataFrame, n: int = 2000,
                        seed: int = 42) -> pd.DataFrame:
    # Augment with synthetic luxury rows (₹15L-₹80L). The cleaned Kaggle data
    # tops out around ₹12L, so without this a ₹50L budget gets no matches.
    # Method: resample the top-priced rows and add small gaussian noise — a
    # standard data-augmentation approach.
    np.random.seed(seed)
    df = df.copy()
    before = len(df)

    threshold = df['selling_price'].quantile(0.85)
    luxury_base = df[df['selling_price'] >= threshold].copy()

    if len(luxury_base) < 10:
        print("[WARN] Not enough luxury rows for augmentation. Skipping.")
        return df

    synth = luxury_base.sample(n=n, replace=True, random_state=seed).copy()

    # Add ±8% noise to the numeric columns.
    noise_cols = ['selling_price', 'km_driven', 'km_per_year']
    for col in noise_cols:
        if col in synth.columns:
            noise = np.random.normal(1.0, 0.08, size=len(synth))
            synth[col] = (synth[col] * noise).clip(lower=0)

    # Nudge the year by ±1, clamped to 2010-2023.
    if 'year' in synth.columns:
        year_noise = np.random.randint(-1, 2, size=len(synth))
        synth['year'] = (synth['year'].astype(int) + year_noise).clip(2010, 2023)
        synth['car_age'] = (CURRENT_YEAR - synth['year']).clip(lower=1)
        synth['km_per_year'] = synth['km_driven'] / synth['car_age']

    synth['_synthetic'] = True
    df['_synthetic']    = False

    combined = pd.concat([df, synth], ignore_index=True)
    print(f"[INFO] Synthetic augmentation: {before} → {len(combined)} rows "
          f"(+{n} synthetic luxury rows)")
    print(f"[INFO] New price range: ₹{combined['selling_price'].min():,.0f} – "
          f"₹{combined['selling_price'].max():,.0f}")

    combined.drop(columns=['_synthetic'], inplace=True)
    return combined


def encode_categoricals(df: pd.DataFrame):
    df = df.copy()

    for col in ['fuel', 'transmission', 'brand']:
        if col in df.columns:
            df[col] = df[col].str.lower().str.strip()

    # Drop brand_model only after model_price_score has been computed from it.
    if 'brand_model' in df.columns:
        df.drop(columns=['brand_model'], inplace=True)

    df = pd.get_dummies(df, columns=['fuel', 'transmission'], drop_first=True)

    le_brand = LabelEncoder()
    df['brand'] = le_brand.fit_transform(df['brand'])

    print(f"[INFO] Encoding complete — shape: {df.shape}")
    return df, le_brand


def get_feature_target(df: pd.DataFrame):
    TARGET    = 'selling_price'
    DROP_COLS = [TARGET, 'year']
    X = df.drop(columns=[c for c in DROP_COLS if c in df.columns])
    y = df[TARGET]
    print(f"[INFO] Features ({len(X.columns)}): {list(X.columns)}")
    print(f"[INFO] Samples: {len(y)}  |  Price: ₹{y.min():,.0f}–₹{y.max():,.0f}")
    return X, y


def preprocess_pipeline(
    final_path: str = FINAL_DATASET_PATH,
    cars_path:  str = CARS_CSV_PATH,
    augment:    bool = True,
):
    # Run the full pipeline. Returns X, y, df_clean, le_brand, feature_cols.
    print("\n" + "─"*55)
    print("  PREPROCESSING PIPELINE")
    print("─"*55)

    df = load_and_merge(final_path, cars_path)
    df = handle_missing_values(df)
    df = engineer_features(df)
    df = add_model_price_score(df)
    df = remove_outliers(df)
    if augment:
        df = add_synthetic_data(df)

    df, le_brand = encode_categoricals(df)
    X, y = get_feature_target(df)

    print(f"\n[INFO] Preprocessing complete")
    print(f"       Total rows    : {len(X)}")
    print(f"       Total features: {len(X.columns)}")
    print("─"*55)

    return X, y, df, le_brand, list(X.columns)


if __name__ == '__main__':
    X, y, df_clean, le_brand, feature_cols = preprocess_pipeline()
    print("\nFeature columns:")
    for f in feature_cols:
        print(f"  {f}")
    print("\nOwner distribution:")
    print(df_clean['owner'].value_counts().sort_index())
    print("\nSeller type distribution:")
    print(df_clean['seller_type'].value_counts())