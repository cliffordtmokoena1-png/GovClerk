const someFunction = async () => {
  // ... other code
  const query = "SELECT user_id, email FROM gc_leads WHERE user_id IS NOT NULL AND email IS NOT NULL ORDER BY user_id ASC";
  // ... other code
};

export default someFunction;