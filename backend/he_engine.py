import tenseal as ts
import base64

def generate_keys():
    context = ts.context(
        ts.SCHEME_TYPE.CKKS,
        poly_modulus_degree=8192,
        coeff_mod_bit_sizes=[60, 40, 40, 60]
    )
    context.generate_galois_keys()
    context.global_scale = 2**40
    context_bytes        = context.serialize(save_secret_key=True)
    public_context_bytes = context.serialize(save_secret_key=False)
    return context_bytes, public_context_bytes

def encrypt_vector(context_bytes: bytes, data: list) -> bytes:
    context   = ts.context_from(context_bytes)
    encrypted = ts.ckks_vector(context, data)
    return encrypted.serialize()

def decrypt_vector(context_bytes: bytes, ciphertext_bytes: bytes) -> list:
    context   = ts.context_from(context_bytes)
    encrypted = ts.lazy_ckks_vector_from(ciphertext_bytes)
    encrypted.link_context(context)
    result    = encrypted.decrypt()
    if hasattr(result, 'tolist'):
        return result.tolist()
    return list(result)

def add_encrypted(public_context_bytes: bytes, ct1_bytes: bytes, ct2_bytes: bytes) -> bytes:
    context = ts.context_from(public_context_bytes)
    ct1     = ts.lazy_ckks_vector_from(ct1_bytes)
    ct2     = ts.lazy_ckks_vector_from(ct2_bytes)
    ct1.link_context(context)
    ct2.link_context(context)
    result  = ct1 + ct2
    return result.serialize()

def multiply_encrypted(public_context_bytes: bytes, ct1_bytes: bytes, ct2_bytes: bytes) -> bytes:
    context = ts.context_from(public_context_bytes)
    ct1     = ts.lazy_ckks_vector_from(ct1_bytes)
    ct2     = ts.lazy_ckks_vector_from(ct2_bytes)
    ct1.link_context(context)
    ct2.link_context(context)
    result  = ct1 * ct2
    return result.serialize()