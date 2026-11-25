/* ==========================================================================
 * uml_pool.h - Static Memory Pool Allocator (Free-List Pattern)
 * Bagian dari UML-to-C Runtime Library
 * ========================================================================== */
#ifndef UML_POOL_H
#define UML_POOL_H

#include "uml_types.h"
#include "uml_port.h"

#define DEFINE_STATIC_POOL(ClassName, TypeName, Capacity)                      \
                                                                               \
static TypeName s_pool_buf_##ClassName[Capacity];                              \
static bool     s_pool_used_##ClassName[Capacity];                             \
static uint32_t s_pool_count_##ClassName = 0;                                  \
                                                                               \
TypeName* ClassName##_pool_alloc(void) {                                       \
    for (size_t i = 0; i < (size_t)(Capacity); ++i) {                          \
        if (!s_pool_used_##ClassName[i]) {                                     \
            s_pool_used_##ClassName[i] = true;                                 \
            s_pool_count_##ClassName++;                                        \
            ClassName##_init(&s_pool_buf_##ClassName[i]);                      \
            return &s_pool_buf_##ClassName[i];                                 \
        }                                                                      \
    }                                                                          \
    UML_ERROR_HOOK(UML_ERR_POOL_EXHAUSTED, #ClassName " pool exhausted");      \
    return NULL;                                                               \
}                                                                              \
                                                                               \
void ClassName##_pool_free(TypeName* inst) {                                   \
    if (inst == NULL) return;                                                  \
    ptrdiff_t idx = inst - s_pool_buf_##ClassName;                             \
    if (idx >= 0 && idx < (ptrdiff_t)(Capacity)) {                             \
        if (s_pool_used_##ClassName[idx]) {                                    \
            ClassName##_destroy(inst);                                         \
            s_pool_used_##ClassName[idx] = false;                              \
            s_pool_count_##ClassName--;                                        \
        }                                                                      \
    }                                                                          \
}

#endif /* UML_POOL_H */
