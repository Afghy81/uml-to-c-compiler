#include "Calculator.h"
#include "runtime_c/uml_port.h"
#include <string.h>

/* ====================================================================== */
/*                      Calculator Implementation                       */
/* ====================================================================== */

// Static instance storage
static Calculator_t s_instance;
static bool s_instance_allocated = false;

// Constructor
Calculator_t *Calculator_create(void) {
  if (s_instance_allocated) {
    return NULL; // Only one instance supported
  }

  Calculator_t *self = &s_instance;
  memset(self, 0, sizeof(*self));
  s_instance_allocated = true;
  self->result = 0;
  self->memory = 0;
  return self;
}

// Destructor
void Calculator_destroy(Calculator_t *self) {
  if (self == &s_instance) {
    s_instance_allocated = false;
  }
}

float Calculator_get_result(const Calculator_t *self) { return self->result; }

void Calculator_set_result(Calculator_t *self, float value) {
  self->result = value;
}

float Calculator_get_memory(const Calculator_t *self) { return self->memory; }

void Calculator_set_memory(Calculator_t *self, float value) {
  self->memory = value;
}

float Calculator_add(Calculator_t *self, float a, float b) { return a + b; }

float Calculator_sub(Calculator_t *self, float a, float b) { return a - b; }

float Calculator_mul(Calculator_t *self, float a, float b) { return a * b; }

float Calculator_div(Calculator_t *self, float a, float b) {
  return (b == 0) ? 0 : a / b;
}

void Calculator_clear(Calculator_t *self) {
  self->result = 0;
  self->memory = 0;
}

void Calculator_store(Calculator_t *self, float value) { self->memory = value; }

float Calculator_recall(Calculator_t *self) { return self->memory; }
