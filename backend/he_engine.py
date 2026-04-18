try:
    import tenseal as ts
    TENSEAL_AVAILABLE = True
    print("Encryption Mode: TenSEAL (CKKS) Active")
except ImportError:
    TENSEAL_AVAILABLE = False
    print("Encryption Mode: Cloud Demo (Plaintext) Active")

def create_context():
    """Creates a CKKS context for encryption."""
    if not TENSEAL_AVAILABLE:
        return "demo-context"
    
    context = ts.context(
        ts.SCHEME_TYPE.CKKS,
        poly_modulus_degree=8192,
        coeff_mod_bit_sizes=[60, 40, 40, 60]
    )
    context.generate_relin_keys()
    context.global_scale = 2**40
    return context

def encrypt_data(context, value: float):
    """Encrypts a value if TenSEAL is available, otherwise returns raw value."""
    if not TENSEAL_AVAILABLE:
        # In cloud demo mode, we just return the value as-is
        return value
    
    return ts.ckks_vector(context, [value])

def decrypt_data(context, encrypted_vector):
    """Decrypts data or returns it if already in plaintext."""
    if not TENSEAL_AVAILABLE:
        return encrypted_vector
    
    return encrypted_vector.decrypt()[0]

# Example of a computation function
def perform_homomorphic_addition(vec1, vec2):
    """Adds two values together."""
    if not TENSEAL_AVAILABLE:
        # Standard math for the website demo
        return vec1 + vec2
    
    # Encrypted math for local environment
    return vec1 + vec2