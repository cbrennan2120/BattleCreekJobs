# Test Plan

## Applicant Flow

1. Complete the form with full weekend and evening availability
2. Confirm the candidate lands as `Top Match` or `Strong Match`
3. Submit a candidate with pay above range
4. Confirm the dashboard pushes that candidate to `Needs Review`
5. Submit a candidate with no Sunday or evening coverage
6. Confirm the manager notes flag the gap

## Manager Flow

1. Load demo applicants
2. Select each applicant card
3. Change pipeline stages
4. Save a manager note
5. Export CSV
6. Export JSON
7. Update store rules in settings and confirm scores recalculate

## Battle Creek-Specific Checks

1. Confirm branding reads `Pet Supplies Plus Battle Creek`
2. Confirm legal entity reads `Battle Creek Pets LLC`
3. Confirm pay range matches the current hiring reality
4. Confirm scheduling link is replaced with the real one before launch
