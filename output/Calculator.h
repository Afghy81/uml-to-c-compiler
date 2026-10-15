#ifndef CALCULATOR_H
#define CALCULATOR_H

#include "runtime_c/uml_pool.h"
#include "runtime_c/uml_types.h"

/* ====================================================================== */
/*                      Calculator Class Interface                      */
/* ====================================================================== */

typedef struct Calculator_s Calculator_t;

// Calculator structure
struct Calculator_s {
  UML_InstanceHeader_t header;
  float result;
  float memory;
};

// Lifecycle functions
Calculator_t *Calculator_create(void);
void Calculator_destroy(Calculator_t *self);

float Calculator_get_result(const Calculator_t *self);
void Calculator_set_result(Calculator_t *self, float value);
float Calculator_get_memory(const Calculator_t *self);
void Calculator_set_memory(Calculator_t *self, float value);

float Calculator_add(Calculator_t *self, float a, float b);
float Calculator_sub(Calculator_t *self, float a, float b);
float Calculator_mul(Calculator_t *self, float a, float b);
float Calculator_div(Calculator_t *self, float a, float b);
void Calculator_clear(Calculator_t *self);
void Calculator_store(Calculator_t *self, float value);
float Calculator_recall(Calculator_t *self);

#endif /* CALCULATOR_H */