import math

def shape_areas(shapes):
    figma = []
    
    for shape in shapes:
        shape_type = shape.get('type')
        
        # Calculate raw area based on the shape type
        if shape_type == 'circle':
            area = 3.14159265 * (shape.get('r') ** 2)
        elif shape_type == 'square':
            area = shape.get('side') ** 2
        elif shape_type == 'rectangle':
            area = shape.get('w') * shape.get('h')
        else:
            continue # Skip unknown shape types safely
            
        # Append the ceiling of the area as an integer
        figma.append(math.ceil(area))
        
    return figma