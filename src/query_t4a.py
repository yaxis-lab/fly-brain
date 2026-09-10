import os

from dotenv import load_dotenv
from neuprint import Client, fetch_neurons


load_dotenv()

TOKEN = os.getenv("TOKEN")

if TOKEN is None:
    raise RuntimeError("TOKEN not found in .env")

client = Client(
    "https://neuprint.janelia.org",
    dataset="male-cns:v1.0",
    token=TOKEN,
)

print("Connected!")
print("Dataset:", client.dataset)


neurons, synapse_counts = fetch_neurons("T4a")

print("\n==============================")
print("NEURON DATA")
print("==============================")

print("Shape:", neurons.shape)

print("\nColumns:")
for column in neurons.columns:
    print("  ", column)


print("\nFirst 5 neurons:")
print(neurons.head())

print("\n==============================")
print("FIRST T4a NEURON")
print("==============================")

first_neuron = neurons.iloc[0]

for key, value in first_neuron.items():
    print(f"{key}: {value}")
    
    
print("\n==============================")
print("SYNAPSE COUNTS")
print("==============================")

print(synapse_counts.head())

print("\nColumns:")
for column in synapse_counts.columns:
    print("  ", column)
