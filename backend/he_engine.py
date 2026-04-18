try:
    import tenseal as ts
    TENSEAL_AVAILABLE = True
    print("Encryption Mode: TenSEAL (CKKS) Active")
except ImportError:
    TENSEAL_AVAILABLE = False
    print("Encryption Mode: Cloud Demo (Plaintext) Active")

def create_context():
    if not TENSEAL_AVAILABLE:
        return "demo-context"
    context = ts.context(ts.SCHEME_TYPE.CKKS, poly_modulus_degree=8192, coeff_mod_bit_sizes=[60, 40, 40, 60])
    context.generate_relin_keys()
    context.global_scale = 2**40
    return context

def generate_keys():
    if not TENSEAL_AVAILABLE:
        return "demo-public-key", "demo-private-key"
    context = create_context()
    return context.serialize().hex(), "secret-key-placeholder"

# Renamed to match your compute.py error
def encrypt_vector(context, value: float):
    if not TENSEAL_AVAILABLE:
        return value
    return ts.ckks_vector(context, [value])

# Renamed to match what compute.py likely expects
def decrypt_vector(context, encrypted_vector):
    if not TENSEAL_AVAILABLE:
        return encrypted_vector
    return encrypted_vector.decrypt()[0]

def perform_computation(val1, val2):
    return val1 + val2